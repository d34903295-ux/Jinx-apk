#include <jni.h>
#include <string>
#include <vector>
#include <atomic>
#include <thread>
#include <random>
#include <fstream>
#include <sstream>
#include <algorithm>
#include <android/log.h>

#include "llama.h"
#include "ggml.h"
#include "ggml-backend.h"

#define LOG_TAG "NODO_LLAMA"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGW(...) __android_log_print(ANDROID_LOG_WARN, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

struct EngineHandle {
    llama_model * model = nullptr;
    llama_context * ctx = nullptr;
    llama_sampler * default_sampler = nullptr;
    std::atomic<bool> stop{false};
    std::vector<llama_token> prev_tokens;
};

static EngineHandle * asHandle(jlong h) {
    return reinterpret_cast<EngineHandle *>(h);
}

// Detecta núcleos grandes (performance cores) leyendo frecuencias máximas de CPU
static unsigned detect_big_cores() {
    unsigned total_cores = std::thread::hardware_concurrency();
    if (total_cores == 0) total_cores = 4;

    std::vector<long> max_freqs;
    for (unsigned i = 0; i < total_cores; ++i) {
        std::string path = "/sys/devices/system/cpu/cpu" + std::to_string(i) + "/cpufreq/cpuinfo_max_freq";
        std::ifstream f(path);
        if (f.is_open()) {
            long freq = 0;
            if (f >> freq && freq > 0) {
                max_freqs.push_back(freq);
            }
        }
    }

    if (!max_freqs.empty()) {
        long top_freq = *std::max_element(max_freqs.begin(), max_freqs.end());
        unsigned big_count = 0;
        for (long freq : max_freqs) {
            if (freq >= top_freq * 0.85) {
                big_count++;
            }
        }
        if (big_count >= 2 && big_count <= 6) {
            LOGI("Detected %u big cores (out of %zu reported)", big_count, max_freqs.size());
            return big_count;
        }
    }

    // Heurística de respaldo para CPUs móviles típicas de 8 núcleos
    if (total_cores >= 8) return 4;
    if (total_cores >= 6) return 4;
    return std::max(2u, std::min(4u, total_cores));
}

// Helper para parsear mensajes simples en JSON [{"role":"...","content":"..."}]
struct SimpleMessage {
    std::string role;
    std::string content;
};

static bool parse_json_messages(const std::string & str, std::vector<SimpleMessage> & out_msgs) {
    if (str.empty() || str[0] != '[') return false;
    size_t pos = 0;
    while ((pos = str.find("{\"role\"", pos)) != std::string::npos) {
        size_t role_val_start = str.find(':', pos);
        if (role_val_start == std::string::npos) break;
        size_t q1 = str.find('\"', role_val_start);
        if (q1 == std::string::npos) break;
        size_t q2 = str.find('\"', q1 + 1);
        if (q2 == std::string::npos) break;
        std::string role = str.substr(q1 + 1, q2 - q1 - 1);

        size_t content_key = str.find("\"content\"", q2);
        if (content_key == std::string::npos) break;
        size_t content_val_start = str.find(':', content_key);
        if (content_val_start == std::string::npos) break;
        size_t cq1 = str.find('\"', content_val_start);
        if (cq1 == std::string::npos) break;

        // Buscar fin del string teniendo en cuenta caracteres escapados
        size_t cq2 = cq1 + 1;
        while (cq2 < str.size()) {
            if (str[cq2] == '\"' && str[cq2 - 1] != '\\') break;
            cq2++;
        }
        if (cq2 >= str.size()) break;

        std::string content_raw = str.substr(cq1 + 1, cq2 - cq1 - 1);
        // Desescapar \n y \" básicos
        std::string content;
        content.reserve(content_raw.size());
        for (size_t i = 0; i < content_raw.size(); ++i) {
            if (content_raw[i] == '\\' && i + 1 < content_raw.size()) {
                if (content_raw[i + 1] == 'n') { content += '\n'; i++; continue; }
                if (content_raw[i + 1] == 'r') { content += '\r'; i++; continue; }
                if (content_raw[i + 1] == 't') { content += '\t'; i++; continue; }
                if (content_raw[i + 1] == '\"') { content += '\"'; i++; continue; }
                if (content_raw[i + 1] == '\\') { content += '\\'; i++; continue; }
            }
            content += content_raw[i];
        }

        out_msgs.push_back({role, content});
        pos = cq2 + 1;
    }
    return !out_msgs.empty();
}

extern "C" {

JNIEXPORT jlong JNICALL
Java_com_example_jinx_llama_LlamaBridge_initModel(JNIEnv * env, jobject /*thiz*/,
                                                  jstring jpath, jint n_ctx, jint n_threads) {
    const char * path = env->GetStringUTFChars(jpath, nullptr);
    LOGI("Loading model: %s", path);

    ggml_backend_load_all();

    llama_model_params mparams = llama_model_default_params();
    mparams.n_gpu_layers = 0; // CPU optimizada por defecto
    mparams.load_mode = LLAMA_LOAD_MODE_MMAP; // mmap activado para carga rápida y bajo uso de RAM

    llama_model * model = llama_model_load_from_file(path, mparams);
    env->ReleaseStringUTFChars(jpath, path);
    if (!model) {
        LOGE("llama_model_load_from_file failed");
        return 0;
    }

    unsigned ncpu = n_threads > 0 ? (unsigned) n_threads : detect_big_cores();
    if (ncpu == 0) ncpu = 4;
    if (ncpu > 8) ncpu = 8; // techo seguro térmico

    llama_context_params cparams = llama_context_default_params();
    cparams.n_ctx = n_ctx > 0 ? (uint32_t) n_ctx : 2048;
    cparams.n_batch = 512;
    cparams.flash_attn_type = LLAMA_FLASH_ATTN_TYPE_AUTO; // Flash Attention activado
    cparams.n_threads = (int32_t) ncpu;
    cparams.n_threads_batch = (int32_t) ncpu;
    cparams.no_perf = false;

    llama_context * ctx = llama_init_from_model(model, cparams);
    if (!ctx) {
        LOGE("llama_init_from_model failed");
        llama_model_free(model);
        return 0;
    }

    llama_sampler_chain_params sparams = llama_sampler_chain_default_params();
    llama_sampler * default_sampler = llama_sampler_chain_init(sparams);
    llama_sampler_chain_add(default_sampler, llama_sampler_init_temp(0.65f));
    llama_sampler_chain_add(default_sampler, llama_sampler_init_dist(LLAMA_DEFAULT_SEED));

    auto * handle = new EngineHandle();
    handle->model = model;
    handle->ctx = ctx;
    handle->default_sampler = default_sampler;
    LOGI("Model loaded: n_ctx=%u threads=%u mmap=true flash_attn=auto", llama_n_ctx(ctx), ncpu);
    return reinterpret_cast<jlong>(handle);
}

JNIEXPORT jstring JNICALL
Java_com_example_jinx_llama_LlamaBridge_generateFull(JNIEnv * env, jobject /*thiz*/,
                                                     jlong h, jstring jprompt,
                                                     jint max_tokens,
                                                     jfloat temp, jfloat top_p,
                                                     jint top_k, jfloat min_p,
                                                     jfloat repeat_penalty,
                                                     jobject jcallback) {
    EngineHandle * handle = asHandle(h);
    if (!handle || !handle->model || !handle->ctx) return env->NewStringUTF("");
    handle->stop.store(false);

    const char * prompt_c = env->GetStringUTFChars(jprompt, nullptr);
    std::string prompt(prompt_c);
    env->ReleaseStringUTFChars(jprompt, prompt_c);

    jclass cbClass = env->GetObjectClass(jcallback);
    jmethodID onToken = env->GetMethodID(cbClass, "onToken", "(Ljava/lang/String;)V");
    jmethodID onDone = env->GetMethodID(cbClass, "onDone", "(Ljava/lang/String;)V");
    jmethodID onStats = env->GetMethodID(cbClass, "onStats", "(IIJJF)V");
    if (env->ExceptionCheck()) {
        env->ExceptionClear();
        onStats = nullptr;
    }
    if (!onToken || !onDone) {
        LOGE("callback methods not found");
        return env->NewStringUTF("");
    }
    auto emit = [&](const std::string & piece) {
        jstring jpiece = env->NewStringUTF(piece.c_str());
        env->CallVoidMethod(jcallback, onToken, jpiece);
        env->DeleteLocalRef(jpiece);
    };

    const llama_vocab * vocab = llama_model_get_vocab(handle->model);

    // Detectar si el modelo es Gemma para manejar correctamente la falta de rol 'system'
    char desc_buf[256] = {0};
    llama_model_desc(handle->model, desc_buf, sizeof(desc_buf));
    std::string model_desc(desc_buf);
    std::string model_desc_lower = model_desc;
    std::transform(model_desc_lower.begin(), model_desc_lower.end(), model_desc_lower.begin(), ::tolower);
    bool is_gemma = (model_desc_lower.find("gemma") != std::string::npos);

    LOGI("llama.cpp model: %s (is_gemma=%d)", model_desc.c_str(), is_gemma ? 1 : 0);

    const char * sys_default = "Responde en español, directo y preciso. Si es simple, responde en 1-2 frases. Si no sabes, dilo.";
    std::vector<SimpleMessage> parsed_msgs;
    std::string system_instruction = sys_default;

    if (parse_json_messages(prompt, parsed_msgs)) {
        for (const auto & m : parsed_msgs) {
            if (m.role == "system" && !m.content.empty()) {
                system_instruction = m.content;
            }
        }
    } else {
        parsed_msgs.push_back({"user", prompt});
    }

    std::vector<std::string> roles_storage;
    std::vector<std::string> contents_storage;
    std::vector<llama_chat_message> chat_msgs;

    if (is_gemma) {
        // En Gemma 2 / 4, el rol 'system' NO está permitido en la plantilla oficial Jinja embebida.
        // Se fusiona el system prompt en el primer turno de usuario:
        bool first_user_done = false;
        for (const auto & m : parsed_msgs) {
            if (m.role == "system") continue;
            if (m.role == "user") {
                if (!first_user_done) {
                    roles_storage.push_back("user");
                    contents_storage.push_back(system_instruction + "\n\n" + m.content);
                    first_user_done = true;
                } else {
                    roles_storage.push_back("user");
                    contents_storage.push_back(m.content);
                }
            } else if (m.role == "assistant" || m.role == "model") {
                roles_storage.push_back("model");
                contents_storage.push_back(m.content);
            }
        }
        if (!first_user_done) {
            roles_storage.push_back("user");
            contents_storage.push_back(system_instruction);
        }
    } else {
        roles_storage.push_back("system");
        contents_storage.push_back(system_instruction);
        for (const auto & m : parsed_msgs) {
            if (m.role != "system") {
                roles_storage.push_back(m.role);
                contents_storage.push_back(m.content);
            }
        }
    }

    for (size_t i = 0; i < roles_storage.size(); ++i) {
        chat_msgs.push_back({roles_storage[i].c_str(), contents_storage[i].c_str()});
    }

    // Template oficial del modelo embebido en GGUF
    const char * tmpl = llama_model_chat_template(handle->model, nullptr);
    std::string full_prompt;

    if (tmpl != nullptr) {
        std::vector<char> buf(32768);
        int n = llama_chat_apply_template(tmpl, chat_msgs.data(), chat_msgs.size(), true, buf.data(), (int32_t) buf.size());
        if (n > 0 && n < (int32_t) buf.size()) {
            full_prompt.assign(buf.data(), n);
        } else if (n > (int32_t) buf.size()) {
            buf.resize(n + 1024);
            int n2 = llama_chat_apply_template(tmpl, chat_msgs.data(), chat_msgs.size(), true, buf.data(), (int32_t) buf.size());
            if (n2 > 0) full_prompt.assign(buf.data(), n2);
        }
    }

    // Fallback de plantilla de chat adaptado al modelo (Gemma vs ChatML)
    if (full_prompt.empty()) {
        if (is_gemma) {
            for (const auto & m : chat_msgs) {
                std::string role(m.role);
                if (role == "user") {
                    full_prompt += "<start_of_turn>user\n" + std::string(m.content) + "<end_of_turn>\n";
                } else {
                    full_prompt += "<start_of_turn>model\n" + std::string(m.content) + "<end_of_turn>\n";
                }
            }
            full_prompt += "<start_of_turn>model\n";
        } else {
            for (const auto & m : chat_msgs) {
                std::string role(m.role);
                full_prompt += "<|im_start|>" + role + "\n" + std::string(m.content) + "<|im_end|>\n";
            }
            full_prompt += "<|im_start|>assistant\n";
        }
    }

    const uint32_t n_ctx = llama_n_ctx(handle->ctx);
    std::vector<llama_token> tokens(n_ctx);
    int n_prompt = llama_tokenize(vocab, full_prompt.c_str(), (int32_t) full_prompt.size(),
                                  tokens.data(), (int32_t) tokens.size(), true, true);
    if (n_prompt < 0) {
        env->CallVoidMethod(jcallback, onDone, env->NewStringUTF("[prompt demasiado largo]"));
        return env->NewStringUTF("");
    }
    tokens.resize(n_prompt);
    if (n_prompt >= (int) n_ctx - 64) {
        env->CallVoidMethod(jcallback, onDone, env->NewStringUTF("[prompt demasiado largo para la ventana de contexto]"));
        return env->NewStringUTF("");
    }

    LOGI("llama.cpp prompt ready: %d tokens (n_ctx=%u, n_batch=512)", (int)tokens.size(), n_ctx);

    // Reutilización de KV Cache: calcular prefijo idéntico con la inferencia anterior
    llama_memory_t mem = llama_get_memory(handle->ctx);
    size_t common_len = 0;
    while (common_len < handle->prev_tokens.size() &&
           common_len < tokens.size() &&
           handle->prev_tokens[common_len] == tokens[common_len]) {
        common_len++;
    }

    if (common_len > 0) {
        llama_memory_seq_rm(mem, 0, (llama_pos) common_len, -1);
        LOGI("Reusing KV cache prefix: %zu tokens", common_len);
    } else {
        llama_memory_clear(mem, true);
    }

    // Configuración de Sampler Chain de alta calidad
    llama_sampler_chain_params sparams = llama_sampler_chain_default_params();
    llama_sampler * smpl = llama_sampler_chain_init(sparams);

    if (repeat_penalty > 1.0f) {
        llama_sampler_chain_add(smpl, llama_sampler_init_penalties(llama_vocab_n_tokens(vocab), 64, repeat_penalty, 0.0f, 0.0f));
    }
    if (top_k > 0) {
        llama_sampler_chain_add(smpl, llama_sampler_init_top_k(top_k));
    }
    if (top_p > 0.0f && top_p < 1.0f) {
        llama_sampler_chain_add(smpl, llama_sampler_init_top_p(top_p, 1));
    }
    if (min_p > 0.0f) {
        llama_sampler_chain_add(smpl, llama_sampler_init_min_p(min_p, 1));
    }
    if (temp > 0.0f) {
        llama_sampler_chain_add(smpl, llama_sampler_init_temp(temp));
    } else {
        llama_sampler_chain_add(smpl, llama_sampler_init_greedy());
    }
    llama_sampler_chain_add(smpl, llama_sampler_init_dist(LLAMA_DEFAULT_SEED));

    int64_t t_start = ggml_time_ms();
    int64_t t_first = 0;

    // Prefill únicamente de los tokens nuevos más allá del prefijo común
    size_t off = common_len;
    while (off < tokens.size()) {
        size_t chunk = tokens.size() - off;
        if (chunk > 512) chunk = 512;
        llama_batch batch = llama_batch_get_one(tokens.data() + off, (int32_t) chunk);
        if (llama_decode(handle->ctx, batch) != 0) {
            llama_sampler_free(smpl);
            env->CallVoidMethod(jcallback, onDone, env->NewStringUTF("[error en prefill de inferencia]"));
            return env->NewStringUTF("");
        }
        off += chunk;
    }

    std::string out;
    int n_decoded = 0;
    const int max_new = max_tokens > 0 ? (int) max_tokens : 512;
    std::vector<llama_token> generated_tokens;

    while (n_decoded < max_new && !handle->stop.load()) {
        llama_token tok = llama_sampler_sample(smpl, handle->ctx, -1);
        if (llama_vocab_is_eog(vocab, tok)) break;

        bool is_ctrl = llama_vocab_is_control(vocab, tok);

        char buf[256];
        // special = false: evita transformar tokens especiales en texto (<unused29>, etc.)
        int nch = llama_token_to_piece(vocab, tok, buf, sizeof(buf), 0, false);
        if (nch > 0 && !is_ctrl) {
            std::string piece(buf, nch);
            // Parar inmediatamente ante tokens de parada típicos sin emitirlos al usuario
            if (piece.find("<|im_end|>") != std::string::npos ||
                piece.find("<end_of_turn>") != std::string::npos ||
                piece.find("<|eot_id|>") != std::string::npos ||
                piece.find("</s>") != std::string::npos) {
                break;
            }
            // Filtrar cualquier token unused o start_of_turn que se escape como texto
            if (piece.find("<unused") == std::string::npos &&
                piece.find("<start_of_turn>") == std::string::npos) {
                if (t_first == 0) t_first = ggml_time_ms();
                out += piece;
                emit(piece);
            }
        }

        n_decoded++;
        generated_tokens.push_back(tok);
        llama_sampler_accept(smpl, tok);
        llama_batch batch = llama_batch_get_one(&tok, 1);
        if (llama_decode(handle->ctx, batch) != 0) break;
        if ((uint32_t)(tokens.size() + n_decoded) >= n_ctx - 8) break;
    }

    llama_sampler_free(smpl);

    int64_t t_end = ggml_time_ms();
    int64_t total_ms = t_end - t_start;
    int64_t ttft_ms = (t_first > 0) ? (t_first - t_start) : total_ms;
    int64_t gen_ms = (t_first > 0) ? (t_end - t_first) : total_ms;
    float tok_per_sec = (gen_ms > 0 && n_decoded > 0) ? (n_decoded * 1000.0f / gen_ms) : 0.0f;

    LOGI("llama.cpp finished: %d tokens in %lld ms (TTFT: %lld ms, %.2f tok/s) [prompt=%zu tokens]",
         n_decoded, (long long)total_ms, (long long)ttft_ms, tok_per_sec, tokens.size());

    // Guardar tokens decodificados para reutilizar en el siguiente turno de conversación
    handle->prev_tokens = tokens;
    handle->prev_tokens.insert(handle->prev_tokens.end(), generated_tokens.begin(), generated_tokens.end());

    if (onStats) {
        env->CallVoidMethod(jcallback, onStats, (jint)tokens.size(), (jint)n_decoded, (jlong)ttft_ms, (jlong)total_ms, tok_per_sec);
    }

    jstring jout = env->NewStringUTF(out.c_str());
    env->CallVoidMethod(jcallback, onDone, jout);
    return jout;
}

JNIEXPORT jstring JNICALL
Java_com_example_jinx_llama_LlamaBridge_generate(JNIEnv * env, jobject thiz,
                                                 jlong h, jstring jprompt,
                                                 jint max_tokens, jobject jcallback) {
    return Java_com_example_jinx_llama_LlamaBridge_generateFull(
        env, thiz, h, jprompt, max_tokens,
        0.65f, // temp por defecto
        0.9f,  // top_p
        40,    // top_k
        0.05f, // min_p
        1.1f,  // repeat_penalty
        jcallback
    );
}

JNIEXPORT void JNICALL
Java_com_example_jinx_llama_LlamaBridge_stop(JNIEnv * /*env*/, jobject /*thiz*/, jlong h) {
    EngineHandle * handle = asHandle(h);
    if (handle) handle->stop.store(true);
}

JNIEXPORT void JNICALL
Java_com_example_jinx_llama_LlamaBridge_free(JNIEnv * /*env*/, jobject /*thiz*/, jlong h) {
    EngineHandle * handle = asHandle(h);
    if (!handle) return;
    if (handle->default_sampler) llama_sampler_free(handle->default_sampler);
    if (handle->ctx) llama_free(handle->ctx);
    if (handle->model) llama_model_free(handle->model);
    delete handle;
}

} // extern "C"


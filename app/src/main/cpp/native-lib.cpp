#include <jni.h>
#include <string>
#include <vector>
#include <atomic>
#include <thread>
#include <random>
#include <android/log.h>

#include "llama.h"
#include "ggml.h"
#include "ggml-backend.h"

#define LOG_TAG "NODO_LLAMA"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

struct EngineHandle {
    llama_model * model = nullptr;
    llama_context * ctx = nullptr;
    llama_sampler * sampler = nullptr;
    std::atomic<bool> stop{false};
};

static EngineHandle * asHandle(jlong h) {
    return reinterpret_cast<EngineHandle *>(h);
}

extern "C" {

JNIEXPORT jlong JNICALL
Java_com_example_jinx_llama_LlamaBridge_initModel(JNIEnv * env, jobject /*thiz*/,
                                                  jstring jpath, jint n_ctx) {
    const char * path = env->GetStringUTFChars(jpath, nullptr);
    LOGI("Loading model: %s", path);

    ggml_backend_load_all();

    llama_model_params mparams = llama_model_default_params();
    mparams.n_gpu_layers = 0; // CPU en el telefono

    llama_model * model = llama_model_load_from_file(path, mparams);
    env->ReleaseStringUTFChars(jpath, path);
    if (!model) {
        LOGE("llama_model_load_from_file failed");
        return 0;
    }

    unsigned ncpu = std::thread::hardware_concurrency();
    if (ncpu == 0) ncpu = 4;
    if (ncpu > 6) ncpu = 6; // techo para no freir la bateria

    llama_context_params cparams = llama_context_default_params();
    cparams.n_ctx = n_ctx > 0 ? (uint32_t) n_ctx : 2048;
    cparams.n_batch = 512;
    cparams.n_threads = (int32_t) ncpu;
    cparams.n_threads_batch = (int32_t) ncpu;

    llama_context * ctx = llama_init_from_model(model, cparams);
    if (!ctx) {
        LOGE("llama_init_from_model failed");
        llama_model_free(model);
        return 0;
    }

    llama_sampler_chain_params sparams = llama_sampler_chain_default_params();
    llama_sampler * sampler = llama_sampler_chain_init(sparams);
    llama_sampler_chain_add(sampler, llama_sampler_init_temp(0.7f));
    llama_sampler_chain_add(sampler, llama_sampler_init_dist(LLAMA_DEFAULT_SEED));

    auto * handle = new EngineHandle();
    handle->model = model;
    handle->ctx = ctx;
    handle->sampler = sampler;
    LOGI("Model loaded, n_ctx=%u threads=%u", llama_n_ctx(ctx), ncpu);
    return reinterpret_cast<jlong>(handle);
}

JNIEXPORT jstring JNICALL
Java_com_example_jinx_llama_LlamaBridge_generate(JNIEnv * env, jobject /*thiz*/,
                                                 jlong h, jstring jprompt,
                                                 jint max_tokens, jobject jcallback) {
    EngineHandle * handle = asHandle(h);
    if (!handle || !handle->model || !handle->ctx) return env->NewStringUTF("");
    handle->stop.store(false);

    const char * prompt_c = env->GetStringUTFChars(jprompt, nullptr);
    std::string prompt(prompt_c);
    env->ReleaseStringUTFChars(jprompt, prompt_c);

    jclass cbClass = env->GetObjectClass(jcallback);
    jmethodID onToken = env->GetMethodID(cbClass, "onToken", "(Ljava/lang/String;)V");
    jmethodID onDone = env->GetMethodID(cbClass, "onDone", "(Ljava/lang/String;)V");
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

    // Plantilla de chat del propio GGUF (vale para Llama 3.2 y Qwen 2.5).
    const char * tmpl = llama_model_chat_template(handle->model, nullptr);
    std::string full_prompt;
    {
        const char * sys = "Eres un asistente util que responde en espanol de forma concisa.";
        std::vector<llama_chat_message> msgs = {
            {"system", sys},
            {"user", prompt.c_str()},
        };
        std::vector<char> buf(16384);
        int n = llama_chat_apply_template(tmpl, msgs.data(), msgs.size(), true, buf.data(), (int32_t) buf.size());
        if (n > 0 && n < (int32_t) buf.size()) {
            full_prompt.assign(buf.data(), n);
        } else {
            full_prompt = std::string("[INST]") + prompt + "[/INST]";
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
        env->CallVoidMethod(jcallback, onDone, env->NewStringUTF("[prompt demasiado largo]"));
        return env->NewStringUTF("");
    }

    llama_memory_clear(llama_get_memory(handle->ctx), true);
    llama_sampler_reset(handle->sampler);

    std::string out;
    int n_decoded = 0;
    const int max_new = max_tokens > 0 ? (int) max_tokens : 512;

    // Prefill del prompt (en un batch; n_prompt < n_batch salvo prompts enormes).
    {
        size_t off = 0;
        while (off < tokens.size()) {
            size_t chunk = tokens.size() - off;
            if (chunk > 512) chunk = 512;
            llama_batch batch = llama_batch_get_one(tokens.data() + off, (int32_t) chunk);
            if (llama_decode(handle->ctx, batch) != 0) {
                env->CallVoidMethod(jcallback, onDone, env->NewStringUTF("[error de inferencia]"));
                return env->NewStringUTF("");
            }
            off += chunk;
        }
    }

    while (n_decoded < max_new && !handle->stop.load()) {
        llama_token tok = llama_sampler_sample(handle->sampler, handle->ctx, -1);
        if (llama_vocab_is_eog(vocab, tok)) break;
        char buf[256];
        int nch = llama_token_to_piece(vocab, tok, buf, sizeof(buf), 0, true);
        if (nch > 0) {
            std::string piece(buf, nch);
            out += piece;
            emit(piece);
        }
        n_decoded++;
        llama_sampler_accept(handle->sampler, tok);
        llama_batch batch = llama_batch_get_one(&tok, 1);
        if (llama_decode(handle->ctx, batch) != 0) break;
        if ((uint32_t)(n_prompt + n_decoded) >= n_ctx - 8) break;
    }
    jstring jout = env->NewStringUTF(out.c_str());
    env->CallVoidMethod(jcallback, onDone, jout);
    return jout;
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
    llama_sampler_free(handle->sampler);
    llama_free(handle->ctx);
    llama_model_free(handle->model);
    delete handle;
}

} // extern "C"

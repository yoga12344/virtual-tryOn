/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_GEMINI_API_KEY: string;
    readonly VITE_HUGGINGFACE_API_KEY: string;
    readonly VITE_COLAB_URL: string;
    readonly VITE_HF_SPACE_URL: string;
    readonly VITE_BACKEND_URL: string;
    readonly VITE_ML_BACKEND_URL: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

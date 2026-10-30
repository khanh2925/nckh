import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
    { ignores: ["dist", "scripts"] },
    {
        files: ["**/*.{ts,tsx}"],
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        languageOptions: { ecmaVersion: 2022, globals: globals.browser },
        plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
        rules: {
            ...reactHooks.configs.recommended.rules,
            "react-refresh/only-export-components": ["warn", { allowConstantExport: true }]
        }
    },
    // Thành phần shadcn/ui sinh bằng CLI: xuất kèm biến thể (buttonVariants…) theo đúng mẫu gốc
    { files: ["src/components/ui/**"], rules: { "react-refresh/only-export-components": "off" } },
    { files: ["vite.config.ts"], languageOptions: { globals: globals.node } }
);

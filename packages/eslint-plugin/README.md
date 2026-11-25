# eslint-plugin-chevron

ESLint plugin for the Chevron rule set. See [RULES.md](../../RULES.md) for every rule, its ID and
its error message.

Status: scaffold. `createRecommendedConfig` already enforces the rules Chevron delegates to
typescript-eslint (CHV002–CHV005) and forbids inline ESLint directives (CHV090). The custom rules
(CHV011 ff.) are not implemented yet; `ruleCatalog` lists all IDs and their planned check.

```js
// eslint.config.js
import { chevron } from 'eslint-plugin-chevron';

export default [...chevron.configs.recommended({ tsconfigRootDir: import.meta.dirname })];
```

The plugin deliberately exports no default export (CHV013 applies to Chevron itself, too).

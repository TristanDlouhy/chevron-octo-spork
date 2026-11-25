# chevron-cli

Project-wide checks that a single-file linter cannot do: module layout (CHV010), barrels (CHV014),
interface/implementation pairs (CHV020), import cycles (CHV032), inline directives as a backstop
(CHV090) and the shrink-only baseline (CHV091).

Status: scaffold. `chevron rules` lists all rule ids; `check` and `baseline` exit with code 2
("not implemented").

```sh
pnpm --filter chevron-cli build
node packages/cli/dist/main.js rules
```

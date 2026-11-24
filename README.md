# juniyadi-plugins

Claude Code plugin marketplace for development and design workflows.

## Add Marketplace

```sh
claude plugin marketplace add JuniYadi/claude-code
```

## Plugins

| Plugin | Category | Description | Install |
|---|---|---|---|
| [**decision-protocol**](plugins/decision-protocol/README.md) | productivity | PRD use case, then ADR decision, then tagged code. Includes checker, git hooks, CI template, and skills (`/decision-protocol:init`, `/decision-protocol:change-protocol`). | `claude plugin install decision-protocol@juniyadi-plugins` |
| [**design-studio**](plugins/design-studio/README.md) | design | Local offline HTML design canvas with live CSS tokens, SVG flow connectors, interactive Play mode, and JSON/bundle import-export (`/design-studio:init`, `/design-studio:design`). | `claude plugin install design-studio@juniyadi-plugins` |

## Tests

Requires Node.js 18+ (zero external dependencies):

```sh
node --test plugins/decision-protocol/tests plugins/design-studio/tests
```

## License

MIT, see [`LICENSE`](LICENSE).

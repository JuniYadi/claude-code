// Example repo-specific rule module. Off by default: list it under "rules" in decision-protocol.config.json.
// A rule may export checkFile({ root, path, text, config, decisions }) and/or checkRepo({ root, files, config, decisions }),
// each returning an array of error strings.
export default {
  name: "no-console",
  checkFile({ text }) {
    return /\bconsole\.log\(/.test(text) ? ["console.log is not allowed in governed code"] : [];
  },
};

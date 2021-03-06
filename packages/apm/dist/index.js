Object.defineProperty(exports, "__esModule", { value: true });
var hubextensions_1 = require("./hubextensions");
var ApmIntegrations = require("./integrations");
exports.Integrations = ApmIntegrations;
var span_1 = require("./span");
exports.Span = span_1.Span;
exports.TRACEPARENT_REGEXP = span_1.TRACEPARENT_REGEXP;
// We are patching the global object with our hub extension methods
hubextensions_1.addExtensionMethods();
//# sourceMappingURL=index.js.map
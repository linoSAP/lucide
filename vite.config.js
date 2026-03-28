var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createRadarAdminRequestHandler } from "./server/radar-admin-handler.mjs";
import { createRadarRequestHandler } from "./server/radar-handler.mjs";
function createRadarProxyPlugin(options) {
    var handleRadarRequest = createRadarRequestHandler(options);
    var handleRadarAdminRequest = createRadarAdminRequestHandler(options);
    return {
        name: "lucide-radar-proxy",
        configureServer: function (server) {
            var _this = this;
            server.middlewares.use(function (request, response, next) { return __awaiter(_this, void 0, void 0, function () {
                var handledAdmin, handled;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, handleRadarAdminRequest(request, response)];
                        case 1:
                            handledAdmin = _a.sent();
                            if (handledAdmin) {
                                return [2 /*return*/];
                            }
                            return [4 /*yield*/, handleRadarRequest(request, response)];
                        case 2:
                            handled = _a.sent();
                            if (!handled) {
                                next();
                            }
                            return [2 /*return*/];
                    }
                });
            }); });
        },
        configurePreviewServer: function (server) {
            var _this = this;
            server.middlewares.use(function (request, response, next) { return __awaiter(_this, void 0, void 0, function () {
                var handledAdmin, handled;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, handleRadarAdminRequest(request, response)];
                        case 1:
                            handledAdmin = _a.sent();
                            if (handledAdmin) {
                                return [2 /*return*/];
                            }
                            return [4 /*yield*/, handleRadarRequest(request, response)];
                        case 2:
                            handled = _a.sent();
                            if (!handled) {
                                next();
                            }
                            return [2 /*return*/];
                    }
                });
            }); });
        },
    };
}
export default defineConfig(function (_a) {
    var _b, _c, _d, _e, _f, _g, _h, _j;
    var mode = _a.mode;
    var env = loadEnv(mode, process.cwd(), "");
    return {
        plugins: [
            react(),
            createRadarProxyPlugin({
                apiKey: (_b = env.ANTHROPIC_API_KEY) !== null && _b !== void 0 ? _b : "",
                supabaseUrl: (_d = (_c = env.SUPABASE_URL) !== null && _c !== void 0 ? _c : env.VITE_SUPABASE_URL) !== null && _d !== void 0 ? _d : "",
                supabaseAnonKey: (_f = (_e = env.SUPABASE_ANON_KEY) !== null && _e !== void 0 ? _e : env.VITE_SUPABASE_ANON_KEY) !== null && _f !== void 0 ? _f : "",
                supabaseServiceRoleKey: (_g = env.SUPABASE_SERVICE_ROLE_KEY) !== null && _g !== void 0 ? _g : "",
                adminPassword: (_h = env.RADAR_ADMIN_PASSWORD) !== null && _h !== void 0 ? _h : "",
                adminSessionSecret: (_j = env.RADAR_ADMIN_SESSION_SECRET) !== null && _j !== void 0 ? _j : "",
            }),
        ],
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src"),
            },
        },
    };
});

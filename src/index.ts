import { Hono } from "hono/tiny";
import webhook from "./routes/webhook";
import api from "./routes/api";

const app = new Hono<{ Bindings: Env }>();

app.route('/webhook', webhook);
app.route('/api', api);

export default app;

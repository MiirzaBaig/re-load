import { streamReceiver } from "../_shared/stream-receiver.ts";
Deno.serve(streamReceiver("sandbox"));

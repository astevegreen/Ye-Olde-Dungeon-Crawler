import { handleRequest, type Env } from './relay';

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
};

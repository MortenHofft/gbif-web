import { RESTDataSource } from '@/RESTDataSource';
import { getDefaultAgent } from '@/requestAgents';

class StatusPageAPI extends RESTDataSource {
  constructor(config) {
    super();
    this.baseURL = config.statusPage;
  }

  willSendRequest(path, request) {
    request.headers['User-Agent'] = this.context.userAgent;
    if (this.baseURL) {
      // Use a function so the correct agent is selected per-hop (handles HTTP→HTTPS redirects)
      request.agent = (url) => getDefaultAgent(url.href, '');
    }
  }

  async getStatus() {
    if (!this.baseURL) {
      throw new Error('StatusPage URL not configured for this environment');
    }
    return this.get('/api/v2/summary.json');
  }
}

export default StatusPageAPI;

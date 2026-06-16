import { RESTDataSource } from '@/RESTDataSource';
import { getDefaultAgent } from '@/requestAgents';

class StatusPageAPI extends RESTDataSource {
  constructor(config) {
    super();
    this.baseURL = config.statusPage;
  }

  willSendRequest(path, request) {
    request.headers['User-Agent'] = this.context.userAgent;
    if (this.context.referer) request.headers['referer'] = this.context.referer;
    if (this.context.clientPriority) request.headers['x-client-priority'] = this.context.clientPriority;
    if (this.context.siteUrl) request.headers['x-gbif-site-url'] = this.context.siteUrl;
    if (this.context.requestId) request.headers['x-request-id'] = this.context.requestId;
    if (this.context.clientIp) request.headers['x-client-ip'] = this.context.clientIp;
    if (this.baseURL) {
      request.agent = getDefaultAgent(this.baseURL, path);
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

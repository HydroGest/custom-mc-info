import { Context, Schema } from 'koishi';
const { MinecraftServerListPing } = require("minecraft-status");

export const name = 'custom-mc-info';

export interface Config {}

export const Config: Schema<Config> = Schema.object({});

export function apply(ctx: Context) {
  // 获取Minecraft服务器信息
  async function getMinecraftServerInfo(address: string, port: number): Promise<any> {
      MinecraftServerListPing.ping(4, address, port, 3000)
      .then(response => {
          return response;
      })
      .catch(error => {
          // Error
      });
  }

  // 此函数用于测试单个域名的延迟
  async function testLatency(domain: string): Promise<number> {
      const startTime = performance.now(); // 记录开始时间
      try {
          // 发起一个HEAD请求来测试延迟
          const response = await fetch(`https://${domain}`, { method: 'HEAD' });
          if (!response.ok) {
              throw new Error(`Request to ${domain} failed with status ${response.status}`);
          }
      } catch (error) {
          // 如果请求失败，返回一个非常大的延迟值
          return Infinity;
      }
      const endTime = performance.now(); // 记录结束时间
      return endTime - startTime; // 计算并返回延迟
  }

  // 此函数用于找出延迟最低的服务器
  async function findLowestLatencyServer(domains: string[]): Promise<{ domain: string; latency: number } | null> {
      if (domains.length === 0) {
          return null;
      }

      let lowestLatency = Infinity;
      let lowestLatencyDomain = '';

      // 遍历所有域名，测试它们的延迟
      for (const domain of domains) {
          const latency = await testLatency(domain);
          if (latency < lowestLatency) {
              lowestLatency = latency;
              lowestLatencyDomain = domain;
          }
      }

      if (lowestLatency === Infinity) {
          return null;
      }

      return { domain: lowestLatencyDomain, latency: lowestLatency };
  }

  ctx.command('mc')
   .action(async (_) => {
          let returnMsg = "";
          const [address, portStr] = 'frp-nut.top:50804'.split(':');
          const port = parseInt(portStr, 10);
          const serverInfo = await getMinecraftServerInfo(address, port);
          if (serverInfo) {
              returnMsg += `服务器当前人数: ${serverInfo.players.online} \n`;
          }

          const domains = [
              'frp-bag.top',
              'frp-gym.top',
              'frp-fee.top',
              'frp-nut.top'
          ];

          const result = await findLowestLatencyServer(domains);
          if (result) {
              returnMsg += `最低延迟的服务器是 ${result.domain}，延迟为 ${result.latency} 毫秒`;
          } else {
              returnMsg += '未能获取到任何服务器的有效延迟信息';
          }

          return returnMsg;
      });
}
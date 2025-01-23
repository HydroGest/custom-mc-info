import { Context, Schema } from 'koishi';

const mcpinger = require('minecraft-server-ping')
 

export const name = 'custom-mc-info';

export interface Config {}

export const Config: Schema<Config> = Schema.object({});

export function apply(ctx: Context) {

  // 此函数用于找出延迟最低的服务器
  async function findLowestLatencyServer(domains: string[]): Promise<{ domain: string; latency: number } | null> {
      if (domains.length === 0) {
          return null;
      }

      let lowestLatency = Infinity;
      let lowestLatencyDomain = '';

      // 遍历所有域名，测试它们的延迟
      for (const domain of domains) {
          const [address, portStr] = domain.split(':');
          
          const data = await mcpinger.ping({hostname: address, port: parseInt(portStr)});
          if (data.ping <= lowestLatency) {
              lowestLatency = data.ping;
              lowestLatencyDomain = domain;
          }
          ctx.logger.info(`${domain}: ${data.ping} ms`);
      }

      if (lowestLatency === Infinity) {
          return null;
      }

      return { domain: lowestLatencyDomain, latency: lowestLatency };
  }

  ctx.command('mc')
   .action(async (_) => {
          let returnMsg = "月之谷服务器 Java 版信息:";
          const [address, portStr] = '100.121.162.102:25565'.split(':');
          const serverInfo = await mcpinger.ping({hostname: address, port: parseInt(portStr) });
          if (serverInfo) {
              returnMsg += `服务器当前人数: ${serverInfo.players.online} \n`;
              if (serverInfo.sample) {
                returnMsg += "当前在线玩家: "
                sample.forEach((player) => {
                  returnMsg += player.name + " ";
                });
                returnMsg += "\n";
              }
          }

          const domains = [
              'frp-bag.top:15920',
              'frp-gym.top:50516',
              'frp-fee.top:50508',
              'frp-nut.top:50804'
          ];

          const result = await findLowestLatencyServer(domains);
          if (result) {
              returnMsg += `当前最优线路: ${result.domain}, 延迟: ${result.latency} ms`;
          } else {
              returnMsg += '未能获取到任何服务器的有效延迟信息';
          }

          return returnMsg;
      });
}

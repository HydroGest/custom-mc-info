import { Context, Schema, segment } from 'koishi';
import { resolve } from 'path';
import { Page } from "puppeteer-core";
import { } from "koishi-plugin-puppeteer";

const mcpinger = require('minecraft-server-ping')
 
export const inject = ['puppeteer']

export const name = 'custom-mc-info';

export interface Config {
    main_address: string;
    sub_address: string[];
    enable_image: boolean;
}

export const Config: Schema<Config> = Schema.object({
    main_address: Schema.string().default("100.121.162.102:25565"),
    sub_address: Schema.array(Schema.string()).default([
        'frp-bag.top:15920',
        'frp-gym.top:50516',
        'frp-fee.top:50508',
        'frp-nut.top:50804',
        'frp-all.top:14159'
    ]),
    enable_image: Schema.boolean().default(false)
});

export function apply(ctx: Context, config: Config) {

    let pageData: {
        players: number,
        bestAddress: string,
        bestPing?: number,
        ping: { address: string, ping: number }[]
    } = {
        players: 0,
        bestAddress: "",
        ping: []
    }

  // 此函数用于找出延迟最低的服务器
  async function findLowestLatencyServer(domains: string[], pageData: {address:string, ping:number}[]): Promise<{ domain: string; latency: number } | null> {
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
          pageData.push({
              address: domain,
              ping: data.ping
          })
      }

      if (lowestLatency === Infinity) {
          return null;
      }

      return { domain: lowestLatencyDomain, latency: lowestLatency };
  }

  ctx.command('mc')
   .action(async (_) => {
       let returnMsg = "月之谷 ~ Lunarine\n";
          const [address, portStr] = config.main_address.split(':');
          const serverInfo = await mcpinger.ping({hostname: address, port: parseInt(portStr) });
          if (serverInfo) {
              returnMsg += `服务器当前人数: ${serverInfo.players.online} \n`;
              pageData.players = serverInfo.players.online;
              if (serverInfo.sample) {
                returnMsg += "当前在线玩家: "
                serverInfo.sample.forEach((player) => {
                  returnMsg += player.name + " ";
                });
                returnMsg += "\n";
              }
          }

          const result = await findLowestLatencyServer(config.sub_address, pageData.ping);
       if (result) {
           pageData.bestAddress = result.domain;
           pageData.bestPing = result.latency;
              returnMsg += `当前最优线路: ${result.domain}, 延迟: ${result.latency} ms`;
          } else {
              returnMsg += '未能获取到任何服务器的有效延迟信息';
          }

       if (config.enable_image) {
            let page: Page = await ctx.puppeteer.page();
            await page.setViewport({ width: 582, height: 300});
            await page.goto(`file:///${resolve(__dirname, "../statics/template.html")}`)
            await page.waitForNetworkIdle();
            await page.evaluate(`action(\`${JSON.stringify(pageData)}\`)`);
           const element = await page.$("body");
           console.log(pageData);
            return (
                segment.image(await element.screenshot({
                    encoding: "binary"
                }), "image/png")
            );
          }
       
          return returnMsg;
      });
}

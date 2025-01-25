import { Context, Schema, segment } from 'koishi'
import { resolve } from 'path'
import { Page } from 'puppeteer-core'
import { } from 'koishi-plugin-puppeteer'

const mcpinger = require('minecraft-server-ping')

export const inject = ['puppeteer']
export const name = 'custom-mc-info'

export interface Config {
  main_address: string
  sub_address: string[]
  enable_image: boolean
  timeout?: number
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
  enable_image: Schema.boolean().default(false),
  timeout: Schema.number().default(5000)
})

export function apply(ctx: Context, config: Config) {
  // 保持原有 pageData 结构
  interface PageData {
    players: number
    bestAddress: string
    bestPing?: number
    ping: { address: string; ping: number }[]
  }

  // 封装服务器测试逻辑
  async function testServers(mainAddress: string, subAddresses: string[]): Promise<PageData> {
    const pageData: PageData = {
      players: 0,
      bestAddress: "",
      ping: []
    }

    try {
      // 测试主服务器
      const [mainHost, mainPort] = mainAddress.split(':')
      const mainInfo = await mcpinger.ping({
        hostname: mainHost,
        port: parseInt(mainPort),
        timeout: config.timeout
      })
      pageData.players = mainInfo.players.online
    } catch (error) {
      ctx.logger.warn('主服务器测试失败:', error)
    }

    // 并行测试子服务器
    const subPromises = subAddresses.map(async (address) => {
      try {
        const [host, port] = address.split(':')
        const subInfo = await mcpinger.ping({
          hostname: host,
          port: parseInt(port),
          timeout: config.timeout
        })
        return { address, ping:  subInfo.ping}
      } catch (error) {
        return { address, ping: Infinity }
      }
    })

    // 处理子服务器结果
    const subResults = await Promise.all(subPromises)
    pageData.ping = subResults.filter(r => r.ping < Infinity)
    
    // 找出最佳服务器
    if (pageData.ping.length > 0) {
      const best = pageData.ping.reduce((a, b) => a.ping < b.ping ? a : b)
      pageData.bestAddress = best.address
      pageData.bestPing = best.ping
    }

    return pageData
  }

  // 生成图片（保持原有格式）
  async function generateImage(pageData: PageData): Promise<segment> {
    let page: Page
    try {
      page = await ctx.puppeteer.page()
      await page.setViewport({ width: 582, height: 300 })
      await page.goto(`file:///${resolve(__dirname, "../statics/template.html")}`)
      await page.waitForNetworkIdle()
      await page.evaluate(`action(\`${JSON.stringify(pageData)}\`)`)
      
      const element = await page.$("body")
      return segment.image(
        await element.screenshot({ encoding: "binary" }),
        "image/png"
      )
    } finally {
      if (page && !page.isClosed()) await page.close()
    }
  }

  ctx.command('mc')
    .action(async () => {
      try {
        // 获取最新数据（每次都是新实例）
        const pageData = await testServers(config.main_address, config.sub_address)

        // 生成响应内容（保持原有格式）
        if (config.enable_image) {
          return await generateImage(pageData)
        }

        let message = '月之谷 ~ Lunarine\n'
        message += `服务器当前人数: ${pageData.players}\n`
        message += `当前最优线路: ${pageData.bestAddress || '无'}`
        if (pageData.bestPing) {
          message += `, 延迟: ${pageData.bestPing}ms`
        }
        return message
      } catch (error) {
        ctx.logger.error('命令执行失败:', error)
        return '服务器状态获取失败'
      }
    })

    ctx.command('map <x:string> <z:string> [zoom:number]')
  .action(async ({ session }, x, z, zoom = 460) => {
    try {
      // 参数验证
      const numX = parseFloat(x)
      const numZ = parseFloat(z)
      const numZoom = parseFloat(zoom.toString())
      
      if (isNaN(numX) || isNaN(numZ) || isNaN(numZoom)) {
        return '参数格式错误，请提供有效的数字坐标和缩放级别'
      }

      // 构建地图 URL
      const mapUrl = `https://map.lunarine.cc/#world:${numX}:0:${numZ}:${numZoom}:0:0:0:0:perspective`

      let page: Page
      try {
        page = await ctx.puppeteer.page()
        // 设置适合地图的视口大小
        await page.setViewport({ width: 1280, height: 720 })
          await page.goto(mapUrl)
          await page.waitForNetworkIdle()
          console.log("Page loaded");
          //, {
        //   waitUntil: 'networkidle2',
        //   timeout: config.timeout 
        // })

          await new Promise(r => setTimeout(r, 6000));        
          console.log("waited for 5s");
        const mapElement = await page.$('#map-container')
        const screenshot = await mapElement.screenshot({ 
          encoding: 'binary',
          type: 'png'
        })

        return segment.image(screenshot, 'image/png')
      } finally {
        if (page && !page.isClosed()) await page.close()
      }
    } catch (error) {
      ctx.logger.error('地图生成失败:', error)
      return '地图生成失败，请稍后再试'
    }
  })
}

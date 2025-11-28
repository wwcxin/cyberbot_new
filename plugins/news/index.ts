import { type Plugin, ctx, napcat, logger, Structs,  } from "../../core/index.js";
import { HttpsProxyAgent } from 'https-proxy-agent';
import axios from 'axios';

// 创建代理 agent
const proxyAgent = new HttpsProxyAgent('http://127.0.0.1:7897'); // Clash 的 HTTP 代理端口

const config = {
    newsApi: 'https://60s.b23.run/v2',
    groupId: await napcat.get_group_list().then(res => res.map(item => item.group_id)),
    blacklist: [707033378, 929275476], // 黑名单群组
    time: '1 8 * * *' // 每天早上 08:01 执行发送
}

// 使用代理获取图片的函数
async function getNewsImageWithProxy() {
    try {
        const response = await axios.get(`${config.newsApi}/60s?encoding=image`, {
            httpsAgent: proxyAgent,
            responseType: 'arraybuffer',
            timeout: 10000
        });
        
        // 将 ArrayBuffer 转换为 base64
        const base64Image = Buffer.from(response.data).toString('base64');
        return `base64://${base64Image}`;
    } catch (err) {
        logger.error(`获取新闻图片失败:${err}`);
        throw err;
    }
}

const plugin: Plugin = {
  name: 'news',  // name必须与此插件文件夹命名一致, 不然可能会出问题
  version: '1.0.1',
  description: '新闻',
  
  handlers: {
    message: async (e) => {
      if (ctx.getText(e) == '60s') {
          try {
              const imageData = await getNewsImageWithProxy();
              e.quick_action([Structs.image(imageData)]);
          } catch (error) {
              logger.error(`发送新闻图片失败:${error}`);
              e.quick_action([Structs.text('获取新闻失败，请稍后重试')]);
          }
      }
    },
  },

  crons(cron) {
    cron(config.time, async () => {
        // 获取新闻图片（使用代理）
        let newsImage;
        try {
            newsImage = await getNewsImageWithProxy();
        } catch (error) {
            logger.error(`定时任务获取新闻图片失败:${error}`);
            return;
        }

        // 向所有除黑名单外的群聊发送每日新闻
        for (const groupId of config.groupId) {
            if (config.blacklist.includes(groupId)) continue;
            try {
                await napcat.send_group_msg({
                    group_id: groupId, 
                    message: [Structs.image(newsImage)]
                });
                // 添加短暂延迟避免频繁请求
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (err) {
                logger.warn(`群${groupId}发送错误：${err}`);
            }
        }
    });
  },
};

export default plugin;
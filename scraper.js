const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const TelegramBot = require('node-telegram-bot-api')
const express = require('express')
const cron = require('node-cron')

const token = '6217087769:AAEfbGTOIsOaRHE2Yma83D_wejFDHVv9Gqo'
const bot = new TelegramBot(token, { polling: false })

const app = express()

// Роут для перевірки стану серверу
app.get('/', (req, res) => {
  res.send('Сервер працює!')
})

// Запускаємо сервер на порту 3000
app.listen(3000, async () => {
  console.log('Сервер запущено на порту 3000!')

  setInterval(() => {
    initScraper()
  }, 1000 * 60 * 60 * 1)

  await initScraper()
})

const initScraper = async () => {
  puppeteer.use(StealthPlugin())

  try {
    puppeteer.launch().then(async browser => {
      console.log('Running tests..')
      const context = await browser.createIncognitoBrowserContext()
      const page = await context.newPage()

      page.setDefaultTimeout(10000)

      await page.goto('https://www.hltv.org/matches')
      await wait()

      await page.waitForSelector(
        '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll'
      )
      await page.$eval(
        '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
        el => el.click()
      )

      await wait()

      const links = await page.$$eval(
        '.upcomingMatchesSection .matchAnalytics',
        links => links.map(link => link.href)
      )

      for (const link of links) {
        try {
          await wait()
          await page.goto(link)
          await page.waitForSelector('.team-odds a')
          await wait()
          const [min, max] = await page.$$eval('.team-odds a', odds =>
            odds.map(odd => {
              const numRegex = /[\d\.]+/
              const match = odd.textContent.match(numRegex)

              return match[0]
            })
          )

          await page.goto('https://ru.surebet.com/calculator')
          await page.waitForSelector('.prong .koefficient')
          await wait()

          await page.evaluate(clear, '.prong[data-number="0"] .koefficient')
          await page.type('.prong[data-number="0"] .koefficient', min)

          await page.evaluate(clear, '.prong[data-number="1"] .koefficient')
          await page.type('.prong[data-number="1"] .koefficient', max)

          await wait()

          const profit = await page.$eval('.profit_percent', el =>
            parseFloat(el.textContent)
          )

          if (profit > 12 && max < 14 && min < 14) {
            bot.sendMessage(
              447698680,
              `link: ${link}\nCoef: ${profit}\nCalculator: https://ru.surebet.com/calculator`
            )
          }
        } catch (error) {
          continue
        }
      }

      await browser.close()
      console.log('finished')
    })
  } catch (err) {
    console.log(123, err)
  }
}

const wait = (ms = 300) => new Promise(r => setTimeout(r, getRandomTimeout(ms)))
const getRandomTimeout = ms => Math.round(Math.random() * (ms - 100) + 100)

const clear = sel => (document.querySelector(sel).value = '')

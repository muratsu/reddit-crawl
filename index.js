import fetch from 'node-fetch'
import { createWriteStream } from 'fs'
import util from 'util'

const SUBREDDIT = 'programming'
const MAXTHINGS = -1
const PRINTWAIT = 2000
const REQUESTSIZE = 100

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const requestJSON = async (url) => {
  let request
  while (true) {
    try {
      request = await fetch(url)
      if (request.status !== 200) {
        console.log('error code', request.status)
        await sleep(5000)
        continue
      } else {
        break
      }
    } catch (err) {
      console.log(err)
      await sleep(5000)
      continue
    }
  }

  return request.json()
}

;(async () => {
  const meta = await requestJSON('https://api.pushshift.io/meta')
  const limitPerMinute = meta.server_ratelimit_per_minute
  const requestWait = 60 / limitPerMinute
  const date = new Date()
  let year = new Intl.DateTimeFormat('en', { year: 'numeric' }).format(date)
  let month = new Intl.DateTimeFormat('en', { month: 'short' }).format(date)
  let day = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(date)
  const timestamp = `${day}-${month}-${year}`
  let totalResults = 0

  console.log('server_ratelimit_per_minute', limitPerMinute)

  const things = ['submission', /*'comment' */]

  for (let thing of things) {
    let i = 0

    const writeStream = createWriteStream(
      `data/${SUBREDDIT}-${thing}_${timestamp}.txt`,
      { flags: 'w', encoding: 'utf-8' }
    )

    if (MAXTHINGS < 0) {
      const url = `https://api.pushshift.io/reddit/search/${thing}/?subreddit=${SUBREDDIT}&metadata=true&size=0`
      let json = await requestJSON(url)
      totalResults = json['metadata']['total_results']
      console.log(`total ${thing}s in r/${SUBREDDIT}: ${totalResults}`)
    } else {
      totalResults = MAXTHINGS
      console.log(`downloading most recent ${MAXTHINGS} ${thing}s`)
    }

    let created_utc = ''
    let startTime = new Date()
    let timePrint = startTime

    while (true) {
      let url = `http://api.pushshift.io/reddit/search/${thing}/?subreddit=${SUBREDDIT}&size=${REQUESTSIZE}&before=${created_utc}`
      let json = await requestJSON(url)

      if (!json.data) break

      let doneHere = false
      for (let post of json.data) {
        created_utc = post.created_utc
        writeStream.write(JSON.stringify(post) + '\r\n')
        //   util.inspect(post, { showHidden: false, depth: null, breakLength: Infinity, compact: true }) + '\n'
        // )
        i++
        if (i >= totalResults) {
          doneHere = true
          break
        }
      }

      if (doneHere) break

      if (new Date() - timePrint > PRINTWAIT) {
        timePrint = new Date()
        let percent = (i / totalResults) * 100
        console.log(`${percent}% done`)
      }

      sleep(requestWait)
    }
  }
})()

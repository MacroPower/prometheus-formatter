/* global chrome, console */

const defaultPaths = [
  '^/metrics',
  '^/federate',
  '^/probe',
  '^/prometheus',
  '^/actuator/prometheus'
]

let encode = str => {
  let buf = [];

  for (var i = str.length - 1; i >= 0; i--) {
    buf.unshift(['&#', str[i].charCodeAt(), ';'].join(''));
  }

  return buf.join('');
}

const formatPrometheusMetrics = (body) => body
  .split(/\r?\n/)
  .map(line => {
    // line is a comment
    if (/^#/.test(line)) {
      return `<span class="comment">${line}</span>`
    }

    // line is a metric
    // Named RegExp groups not supported by Firefox:
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1362154
    // const tmp = line.match(/^(?<metric>[\w_]+)(?:\{(?<tags>.*)\})?\x20(?<value>.+)/)
    const tmp = line.match(/^([\w_]+)(?:\{(.*)\})?\x20(.+)/)

    if (tmp && tmp.length > 1) {
      let [ _, metric, tags, value ] = tmp
      if (tags) {
        var regex = /([^,]+?)="([^"\\]*(?:\\.[^"\\]*)*)"/g
        var match = [...tags.matchAll(regex)];
        tags = ''

        match.map((m, i) => {
          var labelName = '<span class="label-key">' + encode(m[1]) + '</span>'
          var labelValue = '<span class="label-value">' + encode(m[2]) + '</span>'

          if (i !== 0) {
            tags += ','
          }

          tags += `${labelName}="${labelValue}"`
        })

        tags = `{${tags}}`
      }

      return `<span class="metric">${metric}</span>${tags || ''} <span class="value">${value}</span>`
    }

    // line is something else, do nothing
    return line
  })
  .join('<br>')

// Listen for requests from content pages wanting to set up a port
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'promformat') {
    console.error(`[Prometheus Formatter] unknown port name "${port.name}". Aborting.`)
    return
  }

  port.onMessage.addListener(msg => {
    if (msg.name !== 'PROMETHEUS_METRICS_RAW_BODY') {
      return
    }

    // Post the HTML string back to the content script
    port.postMessage({
      name: 'PROMETHEUS_METRICS_FORMATTED_BODY',
      payload: formatPrometheusMetrics(msg.payload)
    })

    // Disconnect
    port.disconnect()
  })
})

// Set default paths on extension installation and update
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get({ paths: [] }, storedData => {
    if (!storedData.paths.length) {
      chrome.storage.sync.set({ paths: defaultPaths })
    }
  })
})

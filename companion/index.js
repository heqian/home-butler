import { peerSocket } from 'messaging'
import { outbox } from 'file-transfer'
import { settingsStorage } from 'settings'
import HomeAssistant from './HomeAssistant'

const DEBUG = false

class HomeButler {
  constructor (enabledDomains = {}) {
    // Create a Home Assistant instance
    this.ha = new HomeAssistant()

    // Enabled domains and max # of devices
    this.enabledDomains = enabledDomains

    // Messaging
    peerSocket.addEventListener('open', this.onOpen.bind(this))
    peerSocket.addEventListener('close', this.onClose.bind(this))
    peerSocket.addEventListener('error', this.onError.bind(this))
    peerSocket.addEventListener('message', this.onMessage.bind(this))

    // Settings
    settingsStorage.addEventListener('change', this.onSettingsChange.bind(this))
  }

  init () {
    let protocol = settingsStorage.getItem('protocol')
    let host = settingsStorage.getItem('host')
    let port = settingsStorage.getItem('port')
    let credential = settingsStorage.getItem('credential')

    protocol = protocol ? JSON.parse(protocol).name : 'https'
    host = host ? JSON.parse(host).name : 'localhost'
    port = port ? JSON.parse(port).name : '443'
    credential = credential ? JSON.parse(credential).name : ''

    const url = `${protocol}://${host}:${port}/api`
    this.ha.configure(url, credential)

    if (DEBUG) console.info('New settings: ' + url)
  }

  async sync () {
    if (DEBUG) console.info('Syncing...')

    // Sync HA
    await this.ha.sync()

    const domains = Object.keys(this.enabledDomains)
    const devices = {}
    domains.forEach(domain => {
      if (this.ha.devices[domain]) {
        devices[domain] = this.ha.devices[domain]
          .filter(device => device.attributes.friendly_name)
          .slice(0, this.enabledDomains[domain])
          .sort((a, b) => { // Sort by name
            return a.attributes.friendly_name.localeCompare(b.attributes.friendly_name)
          })
      }
    })

    this.sendFile('devices.json', devices)
  }

  sendFile (filename, json) {
    // Convert data to ArrayBuffer
    const str = JSON.stringify(json, null, 0)
    const buffer = new ArrayBuffer(str.length * 2)
    const bufferView = new Uint16Array(buffer)
    for (let i = 0, length = str.length; i < length; i++) {
      bufferView[i] = str.charCodeAt(i)
    }

    outbox.enqueue(filename, buffer).then(file => {
      if (DEBUG) console.info('Transfer queued successfully: ' + file.name)
    }).catch(error => {
      console.error(error)
    })
  }

  onOpen () {
    if (DEBUG) console.info('Connection is open!')

    // Send data to the smartwatch
    this.sync()
  }

  onClose () {
    if (DEBUG) console.info('Connection is closed!')
  }

  onError (error) {
    console.error(error)
  }

  async onMessage (event) {
    if (DEBUG) console.info('Data: ' + JSON.stringify(event.data, null, 2))

    const data = event.data
    switch (data.command) {
      case 'service': {
        const apiCall = data.content
        if (this.ha) {
          const states = await this.ha.callService(
            apiCall.domain,
            apiCall.service,
            apiCall.payload
          )
          if (DEBUG) console.info(JSON.stringify(states, null, 2))

          // Send the device state to the smartwatch
          states.forEach(state => {
            const domain = state.entity_id.slice(0, state.entity_id.indexOf('.'))
            if (domain === 'group') {
              return
            }

            peerSocket.send({
              id: state.entity_id,
              domain: domain,
              attributes: state.attributes,
              state: state.state
            })
          })
        }
        break
      }
      case 'wakeup':
      default:
    }
  }

  onSettingsChange () {
    if (DEBUG) console.info('Settings has been changed!')

    this.init()
  }
}

const butler = new HomeButler({ light: 16, switch: 16, climate: 4 })
butler.init()

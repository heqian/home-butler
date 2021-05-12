import document from 'document'
import { peerSocket } from 'messaging'
import { readFileSync } from 'fs'
import { inbox } from 'file-transfer'

const DEBUG = false

class HomeButler {
  constructor () {
    // Messaging
    peerSocket.addEventListener('open', this.onOpen.bind(this))
    peerSocket.addEventListener('close', this.onClose.bind(this))
    peerSocket.addEventListener('error', this.onError.bind(this))
    peerSocket.addEventListener('message', this.onMessage.bind(this))

    // File Transfer
    inbox.addEventListener('newfile', this.newFile.bind(this))
  }

  init () {
    // Wakeup the companion app
    peerSocket.send({
      command: 'wakeup'
    })
  }

  render (devices) {
    let valid = false

    // Render UI of domains
    const domains = Object.keys(devices)

    domains.forEach(domain => {
      if (DEBUG) console.info(`Loaded ${devices[domain].length} devices in domain '${domain}'`)

      const domainDOM = document.getElementById(domain + '-domain')

      if (domainDOM) {
        // Enable UI section for this domain
        domainDOM.style.display = 'inline'

        // Render card UIs
        devices[domain].forEach((device, i) => {
          const deviceDOM = domainDOM.getElementById(`${domain}-${i}`)
          if (deviceDOM) {
            // Enable UI card for this device
            this.setCard(deviceDOM, device)

            // Has at least 1 valid device & domain
            valid = true
          }
        })

        // Initially, select the first card for each section
        domainDOM.getElementsByClassName('panoramaview')[0].value = 0
      }
    })

    const bugDOM = document.getElementById('bug')
    const message = document.getElementById('message')
    if (valid) {
      bugDOM.style.display = 'none'
      message.style.display = 'none'

      // Initially, select the first domain
      document.getElementsByClassName('tumblerview')[0].value = 0
    } else {
      // No valid domain or device
      message
        .getElementById('header')
        .getElementById('text')
        .text = 'Settings'
      message
        .getElementById('copy')
        .getElementById('text')
        .text = 'Please configure your Home Assistant settings in the Fitbit app.'
    }
  }

  setCard (cardDOM, device) {
    const domain = device.id.slice(0, device.id.indexOf('.'))

    // Common
    cardDOM.style.display = 'inline'
    cardDOM.getElementById('name').text = device.attributes.friendly_name

    switch (domain) {
      case 'climate': {
        // Render state
        const state = cardDOM.getElementById('state')
        const background = cardDOM.getElementById('background')
        const temperature = cardDOM.getElementById('temperature')
        const humidity = cardDOM.getElementById('humidity')

        temperature.text = device.attributes.current_temperature + '°'
        humidity.text = device.attributes.current_humidity + '%'

        switch (device.state) {
          case 'heat_cool': {
            background.style.fill = '#61C2F2'
            cardDOM.animate('enable')
            break
          }
          case 'off': {
            cardDOM.animate('disable')
            break
          }
          case 'cool': {
            background.style.fill = '#6CD99A'
            cardDOM.animate('enable')
            break
          }
          case 'heat': {
            background.style.fill = '#FF5967'
            cardDOM.animate('enable')
            break
          }
        }

        // Click action
        cardDOM.onclick = () => {
          if (state.style.opacity > 0) {
            peerSocket.send({
              command: 'service',
              content: {
                domain: domain,
                service: 'set_hvac_mode',
                payload: {
                  entity_id: device.id,
                  hvac_mode: 'heat_cool'
                }
              }
            })
          } else if (state.style.opacity === 0) {
            peerSocket.send({
              command: 'service',
              content: {
                domain: domain,
                service: 'set_hvac_mode',
                payload: {
                  entity_id: device.id,
                  hvac_mode: 'off'
                }
              }
            })
          }
        }

        break
      }
      case 'light':
      case 'switch':
      default: {
        // Render state
        const state = cardDOM.getElementById('state')
        switch (device.state) {
          case 'on': {
            cardDOM.animate('enable')
            break
          }
          case 'off': {
            cardDOM.animate('disable')
            break
          }
        }

        // Click action
        cardDOM.onclick = () => {
          if (state.style.opacity > 0) {
            peerSocket.send({
              command: 'service',
              content: {
                domain: domain,
                service: 'turn_on',
                payload: {
                  entity_id: device.id
                }
              }
            })
          } else if (state.style.opacity === 0) {
            peerSocket.send({
              command: 'service',
              content: {
                domain: domain,
                service: 'turn_off',
                payload: {
                  entity_id: device.id
                }
              }
            })
          }
        }
      }
    }
  }

  onOpen () {
    if (DEBUG) console.info('Connection is open!')
  }

  onClose () {
    if (DEBUG) console.info('Connection is closed!')
  }

  onError (error) {
    console.error(error)
  }

  onMessage (event) {
    if (DEBUG) console.info('Data: ' + JSON.stringify(event.data, null, 2))

    const device = event.data
    const section = document.getElementById(device.domain + '-domain')
    const cards = section.getElementsByClassName(device.domain)
    cards.forEach(card => {
      if (card.getElementById('name').text === device.attributes.friendly_name) {
        this.setCard(card, device)
      }
    })
  }

  newFile () {
    let filename
    do {
      filename = inbox.nextFile()
      if (filename) {
        if (DEBUG) console.info('Received file: ' + filename)
      } else {
        continue
      }

      // Read the configuration file
      let devices = {}
      try {
        const jsonString = String.fromCharCode.apply(null, new Uint16Array(readFileSync('/private/data/' + filename)))
        devices = JSON.parse(jsonString)
      } catch (error) {
        console.error(error)
      } finally {
        this.render(devices)
      }
    } while (filename)
  }
}

const butler = new HomeButler()
butler.init()

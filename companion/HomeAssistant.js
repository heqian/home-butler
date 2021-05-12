class HomeAssistant {
  constructor (apiBaseUrl, credential) {
    this.services = {}
    this.devices = {}

    this.configure(apiBaseUrl, credential)
  }

  configure (apiBaseUrl, credential) {
    this.apiBaseUrl = apiBaseUrl
    this.credential = credential
  }

  async sync () {
    const states = await this.call('GET', '/states')
    const services = await this.call('GET', '/services')
    if (states === undefined || services === undefined) {
      return
    }

    // Available services
    const domain2services = {}
    services.forEach(service => {
      domain2services[service.domain] = Object.keys(service.services)
    })
    this.services = domain2services

    // Available devices
    const domain2devices = {}
    states.forEach(state => {
      const domain = state.entity_id.slice(0, state.entity_id.indexOf('.'))
      if (domain2devices[domain] === undefined) {
        domain2devices[domain] = []
      }
      domain2devices[domain].push({
        id: state.entity_id,
        attributes: state.attributes,
        state: state.state
      })
    })
    this.devices = domain2devices
  }

  async callService (domain, service, payload) {
    return this.call(
      'POST',
      `/services/${domain}/${service}`,
      JSON.stringify(payload, null, 0)
    )
  }

  async call (method, path, body) {
    const headers = new Headers({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.credential}`
    })

    let json
    try {
      // Call API
      const response = await fetch(this.apiBaseUrl + path, {
        method: method,
        headers: headers,
        body: body
      })

      json = await response.json()
    } catch (error) {
      console.error(error)
    }

    return json
  }
}

export default HomeAssistant

function settingsComponent (props) {
  return (
    <Page>
      <Section title={<Text bold align='center'>Home Assistant</Text>}>
        <TextInput label='protocol' settingsKey='protocol' type='text' placeholder='https' />
        <TextInput label='host' settingsKey='host' type='url' placeholder='192.168.0.2' />
        <TextInput label='port' settingsKey='port' type='number' placeholder='443' />
        <TextInput label='credential' settingsKey='credential' type='password' placeholder='Bearer token without "Bearer "' />
      </Section>
    </Page>
  )
}

registerSettingsPage(settingsComponent)

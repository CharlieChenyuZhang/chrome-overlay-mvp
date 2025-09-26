chrome.action.onClicked.addListener(async (tab) => {
  // Open the side panel
  await chrome.sidePanel.open({ windowId: tab.windowId })
})

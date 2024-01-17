import axios from 'axios'

const urlRegex =
  // eslint-disable-next-line
  /(https:\/\/)(gist\.github.com\/)([\w-\d\/]{1,39}\/)([\w]{1,32})/
  //https://gist.github.com/eth-alex/70b10cec9592dfd68fce2bf793fcf99a
  //https://gist.github.com/grapemaster/ee181dd429cbab0056dd643f1d35c4e1
  
export async function resolveProposalDescription(descriptionLink: string) {
    try {
      gistApi.cancel()
      const url = new URL(descriptionLink)
      const desc =
        (await gistApi.fetchGistFile(url.toString())) ?? descriptionLink

      return desc
    } catch {
      return descriptionLink
    }
}

export const gistApi = {
  fetchGistFile: fetchGistFile,
  cancel: function () {
    if (this?.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  },
  abortController: null,
}
async function fetchGistFile(gistUrl: string) {
  const controller = new AbortController()
  if (typeof this !== 'undefined') {
    this.abortController = controller
  }
  const pieces = gistUrl.match(urlRegex)

  
  if (pieces) {
    const justIdWithoutUser = pieces[4]

    if (justIdWithoutUser) {
      const apiUrl = 'https://api.github.com/gists/' + justIdWithoutUser
      const apiResponse = await axios.get(apiUrl, {
        signal: controller.signal,
      })
      if (apiResponse.status === 200) {
        const jsonContent = apiResponse.data
        const nextUrlFileName = Object.keys(jsonContent['files'])[0]
        const nextUrl = jsonContent['files'][nextUrlFileName]['raw_url']
        if (nextUrl.startsWith('https://gist.githubusercontent.com/') ||
            nextUrl.startsWith('https://gist.github.com/')) {
          const fileResponse = await axios.get(nextUrl, {
            signal: controller.signal,
          })
          //console.log('fetchGistFile file', gistUrl, fileResponse)
          return fileResponse.data
        } 
        return undefined
      } else {
        console.warn('could not fetchGistFile', {
          gistUrl,
          apiResponse: apiResponse.data,
        })
      }
    }
  }

  return undefined
}
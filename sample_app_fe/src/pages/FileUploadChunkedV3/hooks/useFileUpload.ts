import useApiMutateData from '@/hooks/customReactQueryHooks/useApiMutateData'
import { API, Slug } from '@/services'

const mutationKey = "fileUploadChunkedV3"


const useFileUpload = () => {
  return useApiMutateData({
    mutationFn: (body:FormData) => {
        return API.post({
            slug: Slug.UPLOAD_CHUNK,
            body
        })
    },
    mutationKey: [mutationKey]
  })
}

export default useFileUpload
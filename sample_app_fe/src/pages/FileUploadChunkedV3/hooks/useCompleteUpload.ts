import useApiMutateData from '@/hooks/customReactQueryHooks/useApiMutateData'
import { API, Slug } from '@/services'

const mutationKey = "useCompleteUpload"


const useCompleteUpload = () => {
  return useApiMutateData({
    mutationFn: (uploadId:string) => {
        return API.post({
            slug: Slug.COMPLETE_UPLOAD,
            body: {uploadId} 
        })
    },
    mutationKey: [mutationKey]
  })
}

export default useCompleteUpload
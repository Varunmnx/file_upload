import useApiMutateData from '@/hooks/customReactQueryHooks/useApiMutateData'
import { API, Slug } from '@/services'

const mutationKey = "useInitiateFileUpload"

interface Body {
    fileName: string;
    fileSize: number;
}

const useInitiateFileUpload = () => {
  return useApiMutateData({
    mutationFn: (body:Body) => {
        return API.post({
            slug: Slug.INITIATE_FILE_UPLOAD,
            body 
        })
    },
    mutationKey: [mutationKey]
  })
}

export default useInitiateFileUpload
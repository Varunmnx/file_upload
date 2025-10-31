import useApiMutateData from '@/hooks/customReactQueryHooks/useApiMutateData'
import { API, Slug } from '@/services'

const mutationKey = "useFileGetStatus"


const useFileGetStatus = () => {
  return useApiMutateData({
    mutationFn: (uploadId:string) => {
        return API.get({
            slug: Slug.FILE_STATUS  + `/${uploadId}` 
        })
    },
    mutationKey: [mutationKey]
  })
}

export default useFileGetStatus
import { useCallback } from 'react'
import { createOwnerVoucher, loadOwnerVouchers, publishOwnerVoucher, updateOwnerVoucher } from '../api/ownerApi'
import { useResource } from './useResource'

export function useVoucherCampaigns(locationId) {
  const load = useCallback((signal) => loadOwnerVouchers(locationId, signal), [locationId])
  const campaigns = useResource(load, locationId)

  async function create(voucher) {
    const { data } = await createOwnerVoucher(locationId, voucher)
    const id = data.data.id
    try {
      await publishOwnerVoucher(locationId, id)
      return { id, published: true }
    } catch {
      return { id, published: false }
    }
  }

  return {
    ...campaigns,
    create,
    save: (current, voucher) => updateOwnerVoucher(locationId, current, voucher),
    publish: (voucherId) => publishOwnerVoucher(locationId, voucherId),
  }
}

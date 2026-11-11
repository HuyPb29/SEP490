import { useState } from 'react'
import { downloadVenueData, loadOwnerLocations } from '../../api/ownerApi'
import { getSelectedLocation, selectLocation } from '../../api/session'
import WorkspaceLayout, { ActionForm, Field, Section } from '../WorkspaceLayout'
import { useResource } from '../workspaceSupport'
import { StaffAccounts } from '../account/AccountPages'

function OwnerLocation() {
  const locations = useResource(loadOwnerLocations)
  const [selected, setSelected] = useState(() => getSelectedLocation() || '')
  const location = locations.data?.find((item) => String(item.id) === selected)
  return <>
    <Section title="Địa điểm làm việc" resource={locations}>
      <Field label="Địa điểm" value={location ? selected : ''} onChange={(event) => {
        selectLocation(event.target.value)
        setSelected(event.target.value)
      }} options={[[ '', 'Chọn địa điểm' ], ...(locations.data ?? []).map((item) => [item.id, item.name + ' · ' + item.status])]} />
      {locations.data?.length === 0 && <p>Bạn chưa có địa điểm.</p>}
    </Section>
    {location && location.status !== 'ACTIVE' && <Section title="Địa điểm đã khóa">
      <ActionForm label="Tải dữ liệu địa điểm" action={() => downloadVenueData()} />
    </Section>}
    {location?.status === 'ACTIVE' && <StaffAccounts key={selected} />}
  </>
}

export default function OwnerWorkspace() {
  return <WorkspaceLayout role="owner" title="Quản lý địa điểm"><OwnerLocation /></WorkspaceLayout>
}

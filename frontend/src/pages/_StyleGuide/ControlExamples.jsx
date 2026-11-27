import { useState } from 'react';
import { Button, Checkbox, DatePicker, DateTimePicker, FileInput, FormField, MonthPicker,
  NumberInput, Radio, Select, Slider, Switch, TimePicker } from '../../components/ui';
import { Modal } from '../../components/common/Modal';
import styles from './StyleGuide.module.css';

/** Development-only examples also exercise the real DOM form contract. */
export default function ControlExamples() {
  const [submitted, setSubmitted] = useState('');
  const [date, setDate] = useState('2026-12-04');
  const [modal, setModal] = useState(false);
  const [points, setPoints] = useState('5');
  return <section id="custom-controls" className={styles.sample} aria-labelledby="custom-controls-title">
    <h2 id="custom-controls-title">Control tùy chỉnh dùng chung</h2>
    <form aria-label="Biểu mẫu control mẫu" onSubmit={event => {
      event.preventDefault();
      setSubmitted(JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))));
    }}>
      <div className={styles.grid}>
        <FormField label="Ngày mẫu" required hint="Tháng 12; không chọn ngày 6.">
          <DatePicker name="date" value={date} minDate="2026-12-01" maxDate="2026-12-31" disabledDates={['2026-12-06']}
            required onChange={event => setDate(event.target.value)} />
        </FormField>
        <FormField label="Ngày linh hoạt"><DatePicker name="flexible" /></FormField>
        <FormField label="Trình độ mẫu" required><Select name="skill" defaultValue="medium" required options={[
          ['', 'Chọn trình độ'], ['new', 'Mới chơi'], ['medium', 'Trung bình'], ['advanced', 'Nâng cao'],
          { value: 'unavailable', label: 'Tạm khóa', disabled: true },
        ]} /></FormField>
        <FormField label="Tỉnh thành mẫu"><Select searchable name="province" defaultValue="hn" options={[
          ['hn', 'Hà Nội'], ['hp', 'Hải Phòng'], ['hcm', 'Thành phố Hồ Chí Minh'],
        ]} /></FormField>
        <FormField label="Thời gian mẫu"><DateTimePicker name="datetime" defaultValue="2026-12-04T10:30" step={1800} /></FormField>
        <FormField label="Giờ mẫu"><TimePicker name="time" defaultValue="10:30" /></FormField>
        <FormField label="Tháng mẫu"><MonthPicker name="month" defaultValue="2026-12" min="2026-01" max="2027-12" /></FormField>
        <FormField label="Số lượng mẫu"><NumberInput name="quantity" min={0} max={10} step={1} defaultValue={2} required /></FormField>
        <FormField label="Tệp mẫu"><FileInput name="attachment" /></FormField>
      </div>
      <div className={styles.row}>
        <Checkbox name="consent" label="Đồng ý mẫu" defaultChecked required />
        <Checkbox label="Đang chọn một phần" indeterminate />
        <Checkbox label="Lựa chọn bị khóa" disabled />
        <Switch name="enabled" label="Nhận thông báo mẫu" defaultChecked />
      </div>
      <fieldset><legend>Chế độ mẫu</legend><Radio name="mode" value="single" label="Một buổi mẫu" defaultChecked /><Radio name="mode" value="package" label="Gói mẫu" /></fieldset>
      <FormField label="Điểm mẫu"><Slider name="points" min={0} max={10} value={points} onChange={event => setPoints(event.target.value)} /></FormField>
      <fieldset disabled><legend>Control bị khóa theo form</legend>
        <Select aria-label="Dropdown bị khóa" name="locked" options={[[1, 'Không thể chọn']]} />
        <DatePicker aria-label="Ngày bị khóa" name="lockedDate" />
      </fieldset>
      <div className={styles.row}>
        <Button type="submit">Gửi biểu mẫu mẫu</Button>
        <Button type="reset" variant="outline">Đặt lại mẫu</Button>
        <Button variant="secondary" onClick={() => setModal(true)}>Mở control trong modal</Button>
      </div>
      <output aria-label="Dữ liệu control mẫu">{submitted}</output>
      <p>Ngày đang chọn: <output aria-label="Ngày state mẫu">{date}</output></p>
    </form>
    {modal && <Modal title="Control trong modal" onClose={() => setModal(false)}>
      <FormField label="Ngày trong modal"><DatePicker defaultValue="2026-12-04" /></FormField>
      <FormField label="Dropdown trong modal"><Select options={[[1, 'Một'], [2, 'Hai']]} /></FormField>
      <Button onClick={() => setModal(false)}>Đóng modal mẫu</Button>
    </Modal>}
  </section>;
}

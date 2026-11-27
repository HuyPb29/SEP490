import { FileInput as SharedFileInput } from '../ui/FileInput';

/** Keep the existing image-picker text and FileList event contract. */
export function FileInput(props) {
  return <SharedFileInput chooseText="Chọn ảnh" emptyText="Chưa chọn ảnh" {...props} />;
}

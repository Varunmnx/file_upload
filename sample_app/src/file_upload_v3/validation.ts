import { PipeTransform, Injectable, ArgumentMetadata, PayloadTooLargeException } from '@nestjs/common';

@Injectable()
export class FileSizeValidationPipe implements PipeTransform {
  constructor(private readonly maxSizeInBytes: number) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  transform(value: Express.Multer.File, _metadata: ArgumentMetadata) {
    if (!value) {
      return value; // Let the controller handle missing file
    }

    if (value.size > this.maxSizeInBytes) {
      const maxSizeInMB = this.maxSizeInBytes / (1024 * 1024);
      throw new PayloadTooLargeException(`File size is too large, maximum size is ${maxSizeInMB}MB`);
    }

    return value;
  }
}

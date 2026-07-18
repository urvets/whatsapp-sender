import { SetMetadata } from '@nestjs/common';

export const KEEP_RAW_RESPONSE_KEY = 'keepRawResponse';
export const KeepRawResponse = () => SetMetadata(KEEP_RAW_RESPONSE_KEY, true);

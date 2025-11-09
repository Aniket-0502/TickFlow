import { IsOptional, IsString, Length } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  toNumber!: string;

  /** Message body; 1..1000 chars to avoid empty/huge payloads. */
  @IsString()
  @Length(1, 1000)
  body!: string;

  @IsOptional()
  @IsString()
  clientMessageId?: string;
}

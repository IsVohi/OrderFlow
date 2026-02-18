import { IsString, IsInt, Min, IsOptional, MaxLength, IsNumber, IsUrl } from 'class-validator';

export class CreateProductDto {
    @IsString()
    @MaxLength(50)
    id: string;

    @IsString()
    @MaxLength(100)
    name: string;

    @IsString()
    @IsOptional()
    @MaxLength(500)
    description?: string;

    @IsNumber()
    @Min(0)
    price: number;

    @IsString()
    @IsOptional()
    @IsUrl()
    imageUrl?: string;

    @IsInt()
    @Min(0)
    totalStock: number;
}

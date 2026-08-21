export class SubsegmentResponseDto {
  id: string;
  name: string;
}

export class SegmentResponseDto {
  id: string;
  name: string;
  subsegments: SubsegmentResponseDto[];
}

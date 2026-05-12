import { Controller } from '@nestjs/common';
import { WorkspaceMemberService } from './workspace-member.service';

@Controller('workspace-member')
export class WorkspaceMemberController {
  constructor(private readonly workspaceMemberService: WorkspaceMemberService) {}
}

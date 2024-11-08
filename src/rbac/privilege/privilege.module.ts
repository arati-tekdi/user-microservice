import { Module } from "@nestjs/common";
import { PrivilegeController } from "./privilege.controller";
import { Privilege } from "./entities/privilege.entity";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HttpModule } from "@nestjs/axios";
import { PostgresModule } from "src/adapters/postgres/postgres-module";
import { PrivilegeAdapter } from "./privilegeadapter";
import { PostgresRoleService } from "src/adapters/postgres/rbac/role-adapter";
import { PostgresPrivilegeService } from "src/adapters/postgres/rbac/privilege-adapter";
import { Role } from "../role/entities/role.entity";
import { Repository } from "typeorm";
import { RolePrivilegeMapping } from "../assign-privilege/entities/assign-privilege.entity";
import { UserRoleMapping } from "../assign-role/entities/assign-role.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Privilege,
      Role,
      UserRoleMapping,
      RolePrivilegeMapping,
    ]),
    TypeOrmModule.forFeature([Privilege, Role, RolePrivilegeMapping]),
    HttpModule,
    PostgresModule,
  ],
  controllers: [PrivilegeController],
  providers: [
    PrivilegeAdapter,
    PostgresPrivilegeService,
    PostgresRoleService,
    Repository,
  ],
})
export class PrivilegeModule {}

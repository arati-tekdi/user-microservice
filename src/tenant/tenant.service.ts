import { HttpStatus, Injectable } from "@nestjs/common";
import { Tenant } from "./entities/tenent.entity";
import APIResponse from "../common/responses/response";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, EntityTarget, Repository } from "typeorm";
import { LoggerUtil } from "../common/logger/LoggerUtil";
import { TypeormService } from "../services/typeorm";
import { API_RESPONSES } from "../common/utils/response.messages";
import { APIID } from "../common/utils/api-id.config";

@Injectable()
export class TenantService {
  constructor(private typeormService: TypeormService) {}

  public async getTenants(request, response) {
    let apiId = APIID.TENANT_LIST;
    try {
      let result = await this.typeormService.find(Tenant, {
        where: { status: "active" },
      });

      if (result.length === 0) {
        return APIResponse.error(
          response,
          apiId,
          API_RESPONSES.NOT_FOUND,
          API_RESPONSES.TENANT_NOT_FOUND,
          HttpStatus.NOT_FOUND
        );
      }

      for (let tenantData of result) {
        let query = `SELECT * FROM public."Roles" WHERE "tenantId" = '${tenantData.tenantId}'`;
        const getRole = await this.typeormService.query(Tenant, query);

        // Add role details to the tenantData object
        let roleDetails = [];
        for (let roleData of getRole) {
          roleDetails.push({
            roleId: roleData.roleId,
            name: roleData.name,
            code: roleData.code,
          });
          tenantData["role"] = roleDetails;
        }
      }

      return APIResponse.success(
        response,
        apiId,
        result,
        HttpStatus.OK,
        API_RESPONSES.TENANT_GET
      );
    } catch (error) {
      const errorMessage = error.message || API_RESPONSES.INTERNAL_SERVER_ERROR;
      LoggerUtil.error(
        `${API_RESPONSES.SERVER_ERROR}`,
        `Error: ${errorMessage}`,
        apiId
      );
      return APIResponse.error(
        response,
        apiId,
        API_RESPONSES.INTERNAL_SERVER_ERROR,
        errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async createTenants(request, tenantCreateDto, response) {
    let apiId = APIID.TENANT_CREATE;
    try {
      let checkExitTenants = await this.typeormService.find(Tenant, {
        where: {
          name: tenantCreateDto?.name,
        },
      });
      if (checkExitTenants.length > 0) {
        return APIResponse.error(
          response,
          apiId,
          API_RESPONSES.CONFLICT,
          API_RESPONSES.TENANT_EXISTS,
          HttpStatus.CONFLICT
        );
      }

      let result = await this.typeormService.save(Tenant, tenantCreateDto);
      return APIResponse.success(
        response,
        apiId,
        result,
        HttpStatus.CREATED,
        API_RESPONSES.TENANT_CREATE
      );
    } catch (error) {
      const errorMessage = error.message || API_RESPONSES.INTERNAL_SERVER_ERROR;
      LoggerUtil.error(
        `${API_RESPONSES.SERVER_ERROR}`,
        `Error: ${errorMessage}`,
        apiId
      );
      return APIResponse.error(
        response,
        apiId,
        API_RESPONSES.INTERNAL_SERVER_ERROR,
        errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async deleteTenants(request, tenantId, response) {
    let apiId = APIID.TENANT_DELETE;
    try {
      let checkExitTenants = await this.typeormService.find(Tenant, {
        where: {
          tenantId: tenantId,
        },
      });
      if (checkExitTenants.length === 0) {
        return APIResponse.error(
          response,
          apiId,
          API_RESPONSES.CONFLICT,
          API_RESPONSES.TENANT_EXISTS,
          HttpStatus.CONFLICT
        );
      }

      let result = await this.typeormService.delete(Tenant, tenantId);
      return APIResponse.success(
        response,
        apiId,
        result,
        HttpStatus.OK,
        API_RESPONSES.TENANT_DELETE
      );
    } catch (error) {
      const errorMessage = error.message || API_RESPONSES.INTERNAL_SERVER_ERROR;
      LoggerUtil.error(
        `${API_RESPONSES.SERVER_ERROR}`,
        `Error: ${errorMessage}`,
        apiId
      );
      return APIResponse.error(
        response,
        apiId,
        API_RESPONSES.INTERNAL_SERVER_ERROR,
        errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async updateTenants(request, tenantId, tenantUpdateDto, response) {
    let apiId = APIID.TENANT_UPDATE;
    try {
      let checkExitTenants = await this.typeormService.find(Tenant, {
        where: {
          tenantId: tenantId,
        },
      });
      if (checkExitTenants.length === 0) {
        return APIResponse.error(
          response,
          apiId,
          API_RESPONSES.CONFLICT,
          API_RESPONSES.TENANT_EXISTS,
          HttpStatus.CONFLICT
        );
      }

      let result = await this.typeormService.update(
        Tenant,
        tenantId,
        tenantUpdateDto
      );
      return APIResponse.success(
        response,
        apiId,
        result,
        HttpStatus.OK,
        API_RESPONSES.TENANT_UPDATE
      );
    } catch (error) {
      const errorMessage = error.message || API_RESPONSES.INTERNAL_SERVER_ERROR;
      LoggerUtil.error(
        `${API_RESPONSES.SERVER_ERROR}`,
        `Error: ${errorMessage}`,
        apiId
      );
      return APIResponse.error(
        response,
        apiId,
        API_RESPONSES.INTERNAL_SERVER_ERROR,
        errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}

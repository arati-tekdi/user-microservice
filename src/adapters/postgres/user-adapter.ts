import { ConsoleLogger, HttpStatus, Injectable } from '@nestjs/common';
import { User } from '../../user/entities/user-entity'
import { FieldValues } from '../../user/entities/field-value-entities';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserCreateDto } from '../../user/dto/user-create.dto';
import jwt_decode from "jwt-decode";
import {
  getKeycloakAdminToken,
  createUserInKeyCloak,
  checkIfUsernameExistsInKeycloak,
} from "../../common/utils/keycloak.adapter.util"
import { ErrorResponse } from 'src/error-response';
import { SuccessResponse } from 'src/success-response';
import { Field } from '../../user/entities/field-entity';
import { CohortMembers } from 'src/cohortMembers/entities/cohort-member.entity';
import { ErrorResponseTypeOrm } from 'src/error-response-typeorm';
import { isUUID } from 'class-validator';
import { UserSearchDto } from 'src/user/dto/user-search.dto';
import { UserTenantMapping } from "src/userTenantMapping/entities/user-tenant-mapping.entity";
import { UserRoleMapping } from "src/rbac/assign-role/entities/assign-role.entity";
import { Tenants } from "src/userTenantMapping/entities/tenant.entity";
import { Cohort } from "src/cohort/entities/cohort.entity";
import { Role } from "src/rbac/role/entities/role.entity";

@Injectable()
export class PostgresUserService {
  axios = require("axios");

  constructor(
    // private axiosInstance: AxiosInstance,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(FieldValues)
    private fieldsValueRepository: Repository<FieldValues>,
    @InjectRepository(Field)
    private fieldsRepository: Repository<Field>,
    @InjectRepository(CohortMembers)
    private cohortMemberRepository: Repository<CohortMembers>,
    @InjectRepository(UserTenantMapping)
    private userTenantMappingRepository: Repository<UserTenantMapping>,
    @InjectRepository(Tenants)
    private tenantsRepository: Repository<Tenants>,
    @InjectRepository(UserRoleMapping)
    private userRoleMappingRepository: Repository<UserRoleMapping>,
    @InjectRepository(Cohort)
    private cohortRepository: Repository<Cohort>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
  ) { }
  async searchUser(tenantId: string,
    request: any,
    response: any,
    userSearchDto: UserSearchDto) {
    try {
      let findData = await this.findAllUserDetails(userSearchDto);
      if (!findData.length) {
        return new SuccessResponse({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Either Filter is wrong or No Data Found For the User',
        });
      }
      return new SuccessResponse({
        statusCode: HttpStatus.OK,
        message: 'Ok.',
        data: findData,
      });
    } catch (e) {
      return new ErrorResponseTypeOrm({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        errorMessage: e,
      });
    }
  }

  async findAllUserDetails(userSearchDto) {
    let { limit, page, filters } = userSearchDto;

    let offset = 0;
    if (page > 1) {
      offset = parseInt(limit) * (page - 1);
    }

    if (limit.trim() === '') {
      limit = '0';
    }

    const whereClause = {};
    if (filters && Object.keys(filters).length > 0) {
      Object.entries(filters).forEach(([key, value]) => {
        whereClause[key] = value;
      });
    }
    const results = await this.usersRepository.find({
      where: whereClause,
      skip: offset,
      take: parseInt(limit),
    });
    return results;
  }

  async getUsersDetailsById(userData: Record<string, string>, response: any) {
    try {
      if (!isUUID(userData.userId)) {
        return new SuccessResponse({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Please Enter Valid User ID',
        });
      }
      const result = {
        userData: {
        }
      };
      let customFieldsArray = [];

      const [filledValues, userDetails, userRole] = await Promise.all([
        this.findFilledValues(userData.userId),
        this.findUserDetails(userData.userId),
        this.findUserRoles(userData.userId,userData.tenantId)
      ]);

      if(userRole){
        userDetails['role'] = userRole.title;
      }

      if (!userDetails) {
        return new SuccessResponse({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'User Not Found',
        });
      }   
      if (!userData.fieldValue) {
        return new SuccessResponse({
          statusCode: HttpStatus.OK,
          message: 'Ok.',
          data: userDetails,
        });
      }    
      const customFields = await this.findCustomFields(userData)
      
      result.userData = userDetails;
      
      const filledValuesMap = new Map(filledValues.map(item => [item.fieldId, item.value]));
      for (let data of customFields) {
        const fieldValue = filledValuesMap.get(data.fieldId);
        const customField = {
          fieldId: data.fieldId,
          label: data.label,
          value: fieldValue || '',
          isRequired: data.fieldAttributes ? data.fieldAttributes['isRequired'] : '',
          isEditable: data.fieldAttributes ? data.fieldAttributes['isEditable'] : '',
          options: data?.fieldParams?.['options'] || {},
          type: data.type || ''
        };
        customFieldsArray.push(customField);
      }


      
      result.userData['customFields'] = customFieldsArray;
      

      return new SuccessResponse({
        statusCode: HttpStatus.OK,
        message: 'User detais Fetched Succcessfully.',
        data: result,
      });

    } catch (e) {
      return new ErrorResponseTypeOrm({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        errorMessage: e,
      });
    }
  }

  async getUsersDetailsByCohortId(userData: Record<string, string>, response: any) {
    let apiId = 'api.users.getAllUsersDetails'
    try {
      if (userData.fieldValue) {
        let getUserDetails = await this.findUserName(userData.cohortId, userData.contextType)
        let result = {
          userDetails: [],
        };

        for (let data of getUserDetails) {
          let userDetails = {
            userId: data.userId,
            userName: data.userName,
            name: data.name,
            role: data.role,
            district: data.district,
            state: data.state,
            mobile: data.mobile,
          }
          result.userDetails.push(userDetails);
        }

        return new SuccessResponse({
          statusCode: HttpStatus.OK,
          message: 'Ok.',
          data: result,
        });

      } else {
        let getUserDetails = await this.findUserName(userData.cohortId, userData.contextType)
        let result = {
          userDetails: [],
        };

        for (let data of getUserDetails) {
          let userDetails = {
            userId: data.userId,
            userName: data.userName,
            name: data.name,
            role: data.role,
            district: data.district,
            state: data.state,
            mobile: data.mobile,
            customField: [],
          }
          const fieldValues = await this.getFieldandFieldValues(data.userId)

          userDetails.customField.push(fieldValues);

          result.userDetails.push(userDetails);
        }

        return new SuccessResponse({
          statusCode: HttpStatus.OK,
          message: 'Ok.',
          data: result,
        });

      }

    } catch (e) {
      return new ErrorResponseTypeOrm({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        errorMessage: e,
      });
    }
  }

  async findUserName(cohortId: string, role: string) {
    let query = `SELECT U."userId", U.username, U.name, U.role, U.district, U.state,U.mobile FROM public."CohortMembers" CM   
    LEFT JOIN public."Users" U 
    ON CM."userId" = U."userId"
    where CM."cohortId" =$1 `
    if (role !== null) {
      query += ` AND U."role" = $2`;
    }
    let result: any[];
    if (role !== null) {
      result = await this.usersRepository.query(query, [cohortId, role]);
    } else {
      result = await this.usersRepository.query(query, [cohortId]);
    }
    return result;
  }

  async getFieldandFieldValues(userId: string) {
    let query = `SELECT Fv."fieldId",F."label" AS FieldName,Fv."value" as FieldValues 
    FROM public."FieldValues" Fv   
    LEFT JOIN public."Fields" F
    ON F."fieldId" = Fv."fieldId"
    where Fv."itemId" =$1 `
    let result = await this.usersRepository.query(query, [userId]);
    return result
  }

  async findUserRoles(userId:string, tenantId:string) {
    
    const getRole = await this.userRoleMappingRepository.findOne({
      where:{
        userId:userId,
        tenantId:tenantId
      }
    })
    
    let role

      role = await this.roleRepository.findOne({
        where:{
          roleId:getRole.roleId,
        },
        select: ["title"]
      })
    return role
  }

  async findUserDetails(userId, username?: any) {
    let whereClause: any = { userId: userId };
    if (username && userId === null) {
      delete whereClause.userId;
      whereClause.username = username;
    }
    let userDetails = await this.usersRepository.findOne({
      where: whereClause,
      select: ["userId", "username", "name", "district", "state", "mobile"]
    })

    const tenentDetails = await this.allUsersTenent(userDetails.userId)

    userDetails['tenantData'] = tenentDetails;
    return userDetails;

  }
  async allUsersTenent(userId: string) {
    const query = `
    SELECT T.name AS tenantName, T."tenantId", UTM."Id" AS userTenantMappingId 
    FROM public."UserTenantMapping" UTM 
    LEFT JOIN public."Tenants" T 
    ON T."tenantId" = UTM."tenantId" 
    WHERE UTM."userId" = $1`;
    const result = await this.usersRepository.query(query, [userId]);
    return result;
  }
  async findCustomFields(userData) {
    let customFields = await this.fieldsRepository.find({
      where: {
        context: userData.context,
      }
    })

    return customFields;
  }
  async findFilledValues(userId: string) {
    let query = `SELECT U."userId",FV."fieldId",FV."value", F."fieldAttributes" FROM public."Users" U 
    LEFT JOIN public."FieldValues" FV
    ON U."userId" = FV."itemId" 
    LEFT JOIN public."Fields" F
    ON F."fieldId" = FV."fieldId" 
    where U."userId" =$1`;

    let result = await this.usersRepository.query(query, [userId]);
    return result;
  }

  async updateUser(userDto, response) {
    try {
      let updatedData = {};
      let errorMessage;
      if (userDto.userData || Object.keys(userDto.userData).length > 0) {
        await this.updateBasicUserDetails(userDto.userId, userDto.userData);
        updatedData['basicDetails'] = userDto.userData;
      }

      if (userDto?.customFields?.length > 0) {

        const getFieldsAttributesQuery = `
          SELECT * 
          FROM "public"."Fields" 
          WHERE "contextType"='STUDENT' AND "fieldAttributes"->>'isEditable' = $1 
        `;
        const getFieldsAttributesParams = ['true'];
        const getFieldsAttributes = await this.fieldsRepository.query(getFieldsAttributesQuery, getFieldsAttributesParams);

        let isEditableFieldId = [];
        for (let fieldDetails of getFieldsAttributes) {
          isEditableFieldId.push(fieldDetails.fieldId);
        }

        // let errorMessage = [];
        let unEditableIdes = [];
        for (let data of userDto.customFields) {
          if (isEditableFieldId.includes(data.fieldId)) {
            const result = await this.updateCustomFields(userDto.userId, data);
            if (result) {
              if (!updatedData['customFields'])
                updatedData['customFields'] = [];
              updatedData['customFields'].push(result);
            }
          } else {
            unEditableIdes.push(data.fieldId)
          }
        }
        if (unEditableIdes.length > 0) {
          errorMessage = `Uneditable fields: ${unEditableIdes.join(', ')}`
        }
      }
      return ({
        statusCode: 200,
        message: "User has been updated successfully.",
        data: updatedData,
        error: errorMessage
      });
    } catch (e) {
      return new ErrorResponseTypeOrm({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        errorMessage: e,
      });
    }
  }

  async updateBasicUserDetails(userId, userData: Partial<User>): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { userId: userId } });
    if (!user) {
      return null;
    }
    Object.assign(user, userData);

    return this.usersRepository.save(user);
  }

  async updateCustomFields(itemId, data) {
    let result = await this.fieldsValueRepository.update({ itemId, fieldId: data.fieldId }, { value: data.value });
    let newResult;
    if (result.affected === 0) {
      newResult = await this.fieldsValueRepository.save({
        itemId,
        fieldId: data.fieldId,
        value: data.value
      });
    }
    Object.assign(result, newResult);
    return result;
  }

  async createUser(request: any, userCreateDto: UserCreateDto) {
    // It is considered that if user is not present in keycloak it is not present in database as well
    try {
      const decoded: any = jwt_decode(request.headers.authorization);
      userCreateDto.createdBy = decoded?.sub
      userCreateDto.updatedBy = decoded?.sub

      //Check duplicate field entry
      if (userCreateDto.fieldValues) {
        let field_values = userCreateDto.fieldValues;
        const validateField = await this.validateFieldValues(field_values);
        
        if (validateField == false) {
          return new ErrorResponseTypeOrm({
            statusCode: HttpStatus.CONFLICT,
            errorMessage: "Duplicate fieldId found in fieldValues.",
          });
        }
      }

      
      // check and validate all fields
      let validateBodyFields = await this.validateBodyFields(userCreateDto)

      if (validateBodyFields == true) {
        userCreateDto.username = userCreateDto.username.toLocaleLowerCase();
        const userSchema = new UserCreateDto(userCreateDto);

        let errKeycloak = "";
        let resKeycloak = "";

        const keycloakResponse = await getKeycloakAdminToken();
        const token = keycloakResponse.data.access_token;
        let checkUserinKeyCloakandDb = await this.checkUserinKeyCloakandDb(userCreateDto)
        let checkUserinDb = await this.checkUserinKeyCloakandDb(userCreateDto.username);
        if (checkUserinKeyCloakandDb) {
          return new ErrorResponseTypeOrm({
            statusCode: HttpStatus.FORBIDDEN,
            errorMessage: "User Already Exist",
          });
        }
        resKeycloak = await createUserInKeyCloak(userSchema, token).catch(
          (error) => {
            errKeycloak = error.response?.data.errorMessage;

            return new ErrorResponseTypeOrm({
              statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
              errorMessage: error,
            });
          }
        );
        userCreateDto.userId = resKeycloak;

        let result = await this.createUserInDatabase(request, userCreateDto);

        let fieldData = {};
        if (userCreateDto.fieldValues) {

          if (result && userCreateDto.fieldValues?.length > 0) {
            let userId = result?.userId;
            for (let fieldValues of userCreateDto.fieldValues) {

              fieldData = {
                fieldId: fieldValues['fieldId'],
                value: fieldValues['value']
              }
              let result = await this.updateCustomFields(userId, fieldData);
              if (!result) {
                return new ErrorResponseTypeOrm({
                  statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
                  errorMessage: `Error is ${result}`,
                });
              }
            }
          }
        }
        
        return new SuccessResponse({
          statusCode: 200,
          message: "User has been created successfully.",
          data: result,
        });
      }
    } catch (e) {
      if (e instanceof ErrorResponseTypeOrm) {
        return e;
      } else {
        return new ErrorResponseTypeOrm({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          errorMessage: e.toString(), // or any custom error message you want
        });
      }
    }
  }

  async validateBodyFields(userCreateDto) {
    for (const tenantCohortRoleMapping of userCreateDto.tenantCohortRoleMapping) {

      const { tenantId, cohortId, roleId } = tenantCohortRoleMapping;

      const [tenantExists, cohortExists, roleExists] = await Promise.all([
        this.tenantsRepository.find({ where: { tenantId } }),
        this.cohortRepository.find({ where: { tenantId, cohortId } }),
        this.roleRepository.find({ where: { roleId } })
      ]);

      if (tenantExists.length === 0) {
        throw new ErrorResponseTypeOrm({
          statusCode: HttpStatus.BAD_REQUEST,
          errorMessage: `Tenant Id '${tenantId}' does not exist.`,
        });
      }

      if (cohortExists.length === 0) {
        throw new ErrorResponseTypeOrm({
          statusCode: HttpStatus.BAD_REQUEST,
          errorMessage: `Cohort Id '${cohortId}' does not exist for this tenant '${tenantId}'.`,
        });
      }

      if (roleExists.length === 0) {
        throw new ErrorResponseTypeOrm({
          statusCode: HttpStatus.BAD_REQUEST,
          errorMessage: `Role Id '${roleId}' does not exist.`,
        });
      }
    }
    return true;
  }


  // Can be Implemeneted after we know what are the unique entties
  async checkUserinKeyCloakandDb(userDto) {
    const keycloakResponse = await getKeycloakAdminToken();
    const token = keycloakResponse.data.access_token;
    const usernameExistsInKeycloak = await checkIfUsernameExistsInKeycloak(
      userDto.username,
      token
    );
    if (usernameExistsInKeycloak.data.length > 0) {
      return usernameExistsInKeycloak;
    }
    return false;
  }

  async createUserInDatabase(request: any, userCreateDto: UserCreateDto) {
    const user = new User()
    user.username = userCreateDto?.username
    user.name = userCreateDto?.name
    user.email = userCreateDto?.email
    user.mobile = Number(userCreateDto?.mobile) || null,
    user.createdBy = userCreateDto?.createdBy
    user.updatedBy = userCreateDto?.updatedBy
    user.userId = userCreateDto?.userId,
      user.state = userCreateDto?.state,
      user.district = userCreateDto?.district,
      user.address = userCreateDto?.address,
      user.pincode = userCreateDto?.pincode

    if (userCreateDto?.dob) {
      user.dob = new Date(userCreateDto.dob);
    }
    
    let result = await this.usersRepository.save(user);

    if (result) {
      for (let mapData of userCreateDto.tenantCohortRoleMapping) {
        let cohortData = {
          userId: result?.userId,
          cohortId: mapData?.cohortId
        }

        await this.addCohortMember(cohortData);

        let tenantRoleMappingData = {
          userId: result?.userId,
          tenantRoleMapping: mapData,
        }
        await this.assignUserToTenant(tenantRoleMappingData, request);
      }
    }
    return result;
  }

  async assignUserToTenant(tenantsData, request) {
    try {
      const tenantId = tenantsData?.tenantRoleMapping?.tenantId;
      const userId = tenantsData?.userId;
      const roleId = tenantsData?.tenantRoleMapping?.roleId;

      if (roleId) {
        const data = await this.userRoleMappingRepository.save({
          userId: userId,
          tenantId: tenantId,
          roleId: roleId,
          createdBy: request['user'].userId,
          updatedBy: request['user'].userId
        })
      }

      const data = await this.userTenantMappingRepository.save({
        userId: userId,
        tenantId: tenantId,
        createdBy: request['user'].userId,
        updatedBy: request['user'].userId
      })


    } catch (error) {
      throw new Error(error)
    }
  }

  public async validateUserTenantMapping(userId: string, tenantId: string) {
    // check if tenant exists
    const tenantExist = await this.tenantsRepository.findOne({ where: { tenantId: tenantId } });
    if (!tenantExist) {
      return false
    } else {
      return true
    }
  }

  async addCohortMember(cohortData) {
    try {
      let result = await this.cohortMemberRepository.insert(cohortData);
      return result;;
    } catch (error) {
      throw new Error(error)
    }
  }

  public async resetUserPassword(
    request: any,
    username: string,
    newPassword: string
  ) {
    try {
      const userData: any = await this.findUserDetails(null, username);
      let userId;

      if (userData?.userId) {
        userId = userData?.userId;
      } else {
        return new ErrorResponse({
          errorCode: `404`,
          errorMessage: "User with given username not found",
        });
      }

      // const data = JSON.stringify({
      //   temporary: "false",
      //   type: "password",
      //   value: newPassword,
      // });

      const keycloakResponse = await getKeycloakAdminToken();
      const resToken = keycloakResponse.data.access_token;
      let apiResponse;

      try {
        apiResponse = await this.resetKeycloakPassword(
          request,
          resToken,
          newPassword,
          userId
        );
      } catch (e) {
        return new ErrorResponse({
          errorCode: `${e.response.status}`,
          errorMessage: e.response.data.error,
        });
      }

      if (apiResponse.statusCode === 204) {
        return new SuccessResponse({
          statusCode: apiResponse.statusCode,
          message: apiResponse.message,
          data: apiResponse.data,
        });
      } else {
        return new ErrorResponse({
          errorCode: "400",
          errorMessage: apiResponse.errors,
        });
      }
    } catch (e) {
      return e;
    }
  }
  public async resetKeycloakPassword(
    request: any,
    token: string,
    newPassword: string,
    userId: string
  ) {
    const data = JSON.stringify({
      temporary: "false",
      type: "password",
      value: newPassword,
    });

    if (!token) {
      const response = await getKeycloakAdminToken();
      token = response.data.access_token;
    }

    let apiResponse;

    const config = {
      method: "put",
      url:
        process.env.KEYCLOAK +
        process.env.KEYCLOAK_ADMIN +
        "/" +
        userId +
        "/reset-password",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      data: data,
    };

    try {
      apiResponse = await this.axios(config);
    } catch (e) {
      return new ErrorResponse({
        errorCode: `${e.response.status}`,
        errorMessage: e.response.data.error,
      });
    }

    if (apiResponse.status === 204) {
      return new SuccessResponse({
        statusCode: apiResponse.status,
        message: apiResponse.statusText,
        data: { msg: "Password reset successful!" },
      });
    } else {
      return new ErrorResponse({
        errorCode: "400",
        errorMessage: apiResponse.errors,
      });
    }
  }

  public async validateFieldValues(field_values) {
    let encounteredKeys = []
    for (const fieldValue of field_values) {
      const fieldId = fieldValue['fieldId'];
      // const [fieldId] = fieldValue.split(":").map(value => value.trim());
      if (encounteredKeys.includes(fieldId)) {
        return false
      }
      encounteredKeys.push(fieldId);
    };
  }

  public async deleteUserById(userId){
    const { KEYCLOAK, KEYCLOAK_ADMIN } = process.env;
     // Validate userId format
     if (!isUUID(userId)) {
      return new ErrorResponseTypeOrm({
          statusCode: HttpStatus.BAD_REQUEST,
          errorMessage: "Please enter a valid UUID for userId",
      });
  }
  
      try {
    // Check if user exists in usersRepository
    const user = await this.usersRepository.findOne({ where :{userId:userId}});
    if (!user) {
        return new ErrorResponseTypeOrm({
            statusCode: HttpStatus.NOT_FOUND,
            errorMessage: "User not found in user table.",
        });
    }  
  
  
       // Delete from User table
        const userResult = await this.usersRepository.delete(userId);
  
        // Delete from CohortMembers table
        const cohortMembersResult = await this.cohortMemberRepository.delete({ userId: userId });
  
        // Delete from UserTenantMapping table
        const userTenantMappingResult = await this.userTenantMappingRepository.delete({ userId: userId });
  
        // Delete from UserRoleMapping table
        const userRoleMappingResult = await this.userRoleMappingRepository.delete({ userId: userId });
  
      // Delete from FieldValues table where ItemId matches userId
        const fieldValuesResult = await this.fieldsValueRepository.delete({ itemId: userId });
  
      const keycloakResponse = await getKeycloakAdminToken();
      const token = keycloakResponse.data.access_token;
  
        await this.axios.delete(`${KEYCLOAK}${KEYCLOAK_ADMIN}/${userId}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }});
  
  
        return new SuccessResponse({
          statusCode: HttpStatus.OK,
          message: "User and related entries deleted Successfully.",
          data: {
            user: userResult
          },
        });
      } catch (e) {
          return new ErrorResponseTypeOrm({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          errorMessage: e,
        });
      }
    }

}






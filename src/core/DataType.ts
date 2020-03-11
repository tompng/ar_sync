type RecordType = { _meta?: { query: any } }
type Values<T> = T[keyof T]
type AddNullable<Test, Type> = null extends Test ? Type | null : Type
type DataTypeExtractField<BaseType, Key extends keyof BaseType> = Exclude<BaseType[Key], null> extends RecordType
  ? AddNullable<BaseType[Key], {}>
  : BaseType[Key] extends RecordType[]
  ? {}[]
  : BaseType[Key]

type DataTypeExtractFieldsFromQuery<BaseType, Fields> = '*' extends Fields
  ? { [key in Exclude<keyof BaseType, '_meta'>]: DataTypeExtractField<BaseType, key> }
  : { [key in Fields & keyof (BaseType)]: DataTypeExtractField<BaseType, key> }

interface ExtraFieldErrorType {
  error: 'extraFieldError';
}

type DataTypeExtractFromQueryHash<BaseType, QueryType> = '*' extends keyof QueryType
  ? {
      [key in Exclude<(keyof BaseType) | (keyof QueryType), '_meta' | '_params' | '*'>]: (key extends keyof BaseType
        ? (key extends keyof QueryType
            ? (QueryType[key] extends true
                ? DataTypeExtractField<BaseType, key>
                : AddNullable<BaseType[key], DataTypeFromQuery<BaseType[key] & {}, QueryType[key]>>)
            : DataTypeExtractField<BaseType, key>)
        : ExtraFieldErrorType)
    }
  : {
      [key in keyof QueryType]: (key extends keyof BaseType
        ? (QueryType[key] extends true
            ? DataTypeExtractField<BaseType, key>
            : AddNullable<BaseType[key], DataTypeFromQuery<BaseType[key] & {}, QueryType[key]>>)
        : ExtraFieldErrorType)
    }

type _DataTypeFromQuery<BaseType, QueryType> = QueryType extends keyof BaseType | '*'
  ? DataTypeExtractFieldsFromQuery<BaseType, QueryType>
  : QueryType extends Readonly<(keyof BaseType | '*')[]>
  ? DataTypeExtractFieldsFromQuery<BaseType, Values<QueryType>>
  : QueryType extends { as: string }
  ? { error: 'type for alias field is not supported' } | undefined
  : DataTypeExtractFromQueryHash<BaseType, QueryType>

export type DataTypeFromQuery<BaseType, QueryType> = BaseType extends any[]
  ? CheckAttributesField<BaseType[0], QueryType>[]
  : AddNullable<BaseType, CheckAttributesField<BaseType & {}, QueryType>>

type CheckAttributesField<P, Q> = Q extends { attributes: infer R }
  ? _DataTypeFromQuery<P, R>
  : _DataTypeFromQuery<P, Q>

type IsAnyCompareLeftType = { __any: never }

type CollectExtraFields<Type, Key> =
  IsAnyCompareLeftType extends Type
  ? never
  : Type extends ExtraFieldErrorType
  ? Key
  : Type extends (infer R)[]
  ? {
    0: Values<{ [key in keyof R]: CollectExtraFields<R[key], key> }>
    1: never
  }[R extends object ? 0 : 1]
  : {
    0: Values<{ [key in keyof Type]: CollectExtraFields<Type[key], key> }>
    1: never
  }[Type extends object ? 0 : 1]

type SelectString<T> = T extends string ? T : never
type _ValidateDataTypeExtraFileds<Extra, Type> = SelectString<Extra> extends never
  ? Type
  : { error: { extraFields: Extra } }
type ValidateDataTypeExtraFileds<Type> = _ValidateDataTypeExtraFileds<CollectExtraFields<Type, never>, Type>

type RequestBase = { api: string; query: any; id?: number; params?: any; _meta?: { data: any } }
type DataTypeBaseFromRequestType<R extends RequestBase, ID> = R extends { _meta?: { data: infer DataType } }
  ? (
      ID extends number
      ? ([DataType, R['params']] extends [(infer DT)[], { ids: number[] } | undefined] ? DT : never)
      : DataType
    )
  : never
export type DataTypeFromRequest<Req extends RequestBase, R extends RequestBase> = ValidateDataTypeExtraFileds<
  DataTypeFromQuery<DataTypeBaseFromRequestType<Req, R['id']>, R['query']>
>

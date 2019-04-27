type NonOptionalType<T> = { [key in keyof T]-?: T[key] } // TODO: remove ? from BaseType definitions
type RecordType = { _meta?: { query: any } }
type Unpacked<T> = T extends { [K in keyof T]: infer U } ? U : never
type DataTypeExtractField<BaseType, Key extends keyof BaseType> = NonOptionalType<BaseType>[Key] & {} extends RecordType
  ? (null extends BaseType[Key] ? {} | null : {})
  : NonOptionalType<BaseType>[Key] extends RecordType[]
  ? {}[]
  : NonOptionalType<BaseType>[Key]

type DataTypeExtractFieldsFromQuery<BaseType, Fields> = '*' extends Fields
  ? { [key in Exclude<keyof BaseType, '_meta'>]: DataTypeExtractField<BaseType, key> }
  : { [key in Fields & keyof (BaseType)]: DataTypeExtractField<BaseType, key> }

interface ExtraFieldErrorType {
  error: 'extraFieldError'
}
type DataTypeExtractFromQueryHash<BaseType, QueryType> = '*' extends keyof QueryType
  ? {
      [key in Exclude<(keyof BaseType) | (keyof QueryType), '_meta' | '_params' | '*'>]: (key extends keyof BaseType
        ? (key extends keyof QueryType
            ? (QueryType[key] extends true
                ? DataTypeExtractField<BaseType, key>
                : DataTypeFromQuery<BaseType[key] & {}, QueryType[key]>)
            : DataTypeExtractField<BaseType, key>)
        : ExtraFieldErrorType)
    }
  : {
      [key in keyof QueryType]: (key extends keyof BaseType
        ? (QueryType[key] extends true
            ? DataTypeExtractField<BaseType, key>
            : DataTypeFromQuery<BaseType[key] & {}, QueryType[key]>)
        : ExtraFieldErrorType)
    }

type _DataTypeFromQuery<BaseType, QueryType> = QueryType extends keyof BaseType | '*'
  ? DataTypeExtractFieldsFromQuery<NonOptionalType<BaseType>, QueryType>
  : QueryType extends Readonly<(keyof BaseType | '*')[]>
  ? DataTypeExtractFieldsFromQuery<NonOptionalType<BaseType>, Unpacked<QueryType>>
  : QueryType extends { as: string }
  ? { error: 'type for alias field is not supported' } | undefined
  : QueryType extends { attributes: any }
  ? DataTypeExtractFromQueryHash<BaseType, QueryType['attributes']>
  : DataTypeExtractFromQueryHash<BaseType, QueryType>

export type DataTypeFromQuery<BaseType, QueryType> = BaseType extends any[]
  ? _DataTypeFromQuery<BaseType[0], QueryType>[]
  : null extends BaseType
  ? _DataTypeFromQuery<BaseType & {}, QueryType> | null
  : _DataTypeFromQuery<BaseType & {}, QueryType>

type IsAnyCompareLeftType = { __any: never }

type CollectExtraFields<Type, Path> = IsAnyCompareLeftType extends Type
  ? null
  : Type extends ExtraFieldErrorType
  ? Path
  : Type extends (infer R)[]
  ? _CollectExtraFields<R>
  : Type extends object
  ? _CollectExtraFields<Type>
  : null
type _CollectExtraFields<Type> = keyof (Type) extends never
  ? null
  : Unpacked<{ [key in keyof Type]: CollectExtraFields<Type[key], [key]>}>

type _ValidateDataTypeExtraFileds<Extra, Type> = Unpacked<Extra> extends string
  ? { error: { extraFields: Unpacked<Extra> } }
  : Type
type ValidateDataTypeExtraFileds<Type> = _ValidateDataTypeExtraFileds<CollectExtraFields<Type, []>, Type>

type RequestBase = { api: string; query: any; params?: any; _meta?: { data: any } }
type DataTypeBaseFromRequestType<R> = R extends { _meta?: { data: infer DataType } } ? DataType : never
export type DataTypeFromRequest<Req extends RequestBase, R extends RequestBase> = ValidateDataTypeExtraFileds<
  DataTypeFromQuery<DataTypeBaseFromRequestType<Req>, R['query']>
>

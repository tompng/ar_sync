type NonOptionalType<T> = { [key in keyof T]-?: T[key] } // TODO: remove ? from BaseType definitions
type RecordType = { _meta?: { query: any } }
type Unpacked<T> = T extends { [K in keyof T]: infer U } ? U : never
type DataTypeExtractField<BaseType, Key extends keyof BaseType> = NonOptionalType<BaseType>[Key] & {} extends RecordType
  ? (null extends BaseType[Key] ? {} | null : {})
  : NonOptionalType<BaseType>[Key] extends RecordType[]
  ? {}[]
  : NonOptionalType<BaseType>[Key]

type DataTypeExtractFieldsFromQuery<BaseType, Fields> = {
  [key in Fields & keyof (BaseType)]: DataTypeExtractField<BaseType, key>
}
type DataTypeExtractFromQueryHash<BaseType, QueryType> = {
  [key in (keyof BaseType) & (keyof QueryType)]: (
    QueryType[key] extends true
    ? DataTypeExtractField<BaseType, key>
    : DataTypeFromQuery<BaseType[key] & {}, QueryType[key]>
  )
}

type _DataTypeFromQuery<BaseType, QueryType> = QueryType extends keyof BaseType
  ? DataTypeExtractFieldsFromQuery<NonOptionalType<BaseType>, QueryType>
  : QueryType extends Readonly<(keyof BaseType)[]>
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

type SelectNonOptionalQueryHash<T> = T extends string | true | string[]
  ? never
  : T extends { params: any }
  ? never
  : NonOptionalType<T & object>
type _ValidateNoExtraField<QueryType, Type> = Type extends boolean
  ? true
  : Type extends string
  ? (Type extends QueryType ? true : false)
  : Type extends Readonly<string[]>
  ? (Unpacked<Type> extends QueryType ? true : false)
  : keyof (Type) extends (keyof SelectNonOptionalQueryHash<QueryType & object>)
  ? (false extends Unpacked<
      {
        [key in (keyof SelectNonOptionalQueryHash<QueryType & object>) & (keyof Type)]: (ValidateNoExtraField<
          SelectNonOptionalQueryHash<QueryType & object>[key],
          Type[key]
        >)
      }
    >
      ? false
      : true)
  : false
export type ValidateNoExtraField<QueryType, Type> = Type extends { attributes: string | string[] | {} }
  ? _ValidateNoExtraField<QueryType, Type['attributes']>
  : _ValidateNoExtraField<QueryType, Type>

type RequestBase = { api: string; query: any; params?: any; _meta?: { data: any } }
type DataTypeBaseFromRequestType<R> = R extends { _meta?: { data: infer DataType } } ? DataType : never
export type DataTypeFromRequest<Req extends RequestBase, R extends RequestBase> =
  true extends ValidateNoExtraField<Req['query'], R['query']>
    ? DataTypeFromQuery<DataTypeBaseFromRequestType<Req>, R['query']>
    : never

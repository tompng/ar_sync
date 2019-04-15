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

type Cons<X, XS extends any[]> = ((h: X, ...args: XS) => void) extends ((...args: infer R)=> void) ? R : []
type SelectNonOptionalQueryHash<T> = Exclude<NonOptionalType<T>, undefined | true | string | string[] | { attributes: any }>
type _CollectQueryExtraField<QueryHashType, Type, Path extends any[]> = Type extends boolean
  ? null
  : Type extends string
  ? (Type extends keyof QueryHashType ? null : Cons<Exclude<Type, keyof QueryHashType>, Path>)
  : Type extends Readonly<string[]>
  ? (Unpacked<Type> extends keyof QueryHashType ? null : Cons<Exclude<Unpacked<Type>, keyof QueryHashType>, Path>)
  : (keyof Type) extends (keyof QueryHashType)
  ? Unpacked<
      {
        [key in (keyof QueryHashType) & (keyof Type)]:
          CollectQueryExtraField<QueryHashType[key], Type[key], Cons<key, Path>>
      }
    >
  : Cons<Exclude<keyof Type, keyof QueryHashType>, Path>

export type CollectQueryExtraField<QueryType, Type, Path extends any[]> = Type extends { attributes: string | string[] | {} }
  ? _CollectQueryExtraField<SelectNonOptionalQueryHash<QueryType>, Type['attributes'], Cons<'attributes', Path>>
  : _CollectQueryExtraField<SelectNonOptionalQueryHash<QueryType>, Type, Path>

type RequestBase = { api: string; query: any; params?: any; _meta?: { data: any } }
type DataTypeBaseFromRequestType<R> = R extends { _meta?: { data: infer DataType } } ? DataType : never
export type DataTypeFromRequest<Req extends RequestBase, R extends RequestBase> =
  CollectQueryExtraField<Req['query'], R['query'], []> extends null
    ? DataTypeFromQuery<DataTypeBaseFromRequestType<Req>, R['query']>
    : { error: { extraField: Exclude<CollectQueryExtraField<Req['query'], R['query'], []>, null> } }

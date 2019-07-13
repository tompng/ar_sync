type RecordType = { _meta?: { query: any } }
type Values<T> = T extends { [K in keyof T]: infer U } ? U : never
type DataTypeExtractField<BaseType, Key extends keyof BaseType> = BaseType[Key] extends RecordType
  ? (null extends BaseType[Key] ? {} | null : {})
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
      [key in Exclude<(keyof BaseType) | (keyof QueryType), '_meta' | '*'>]: (
        key extends keyof QueryType
        ? _DataTypePickField<BaseType, key, QueryType[key]>
        : key extends keyof BaseType
        ? DataTypeExtractField<BaseType, key>
        : ExtraFieldErrorType
      )
    }
  : { [key in keyof QueryType]: _DataTypePickField<BaseType, key, QueryType[key]> }

type _DataTypePickField<BaseType, Key, SubQuery> =
  SubQuery extends { field: infer N, query?: infer Q }
  ? (
      N extends keyof BaseType
      ? (
          IsAnyCompareLeftType extends Q
          ? DataTypeExtractField<BaseType, N>
          : DataTypeFromQuery<BaseType[N], Q>)
      : ExtraFieldErrorType
    )
  : (
      Key extends keyof BaseType
      ? (SubQuery extends true | { query?: true | never; params: any }
        ? DataTypeExtractField<BaseType, Key>
        : DataTypeFromQuery<BaseType[Key], SubQuery extends { query: infer Q } ? Q : SubQuery>)
      : ExtraFieldErrorType
    )

type _DataTypeFromQuery<BaseType, QueryType> = QueryType extends keyof BaseType | '*'
  ? DataTypeExtractFieldsFromQuery<BaseType, QueryType>
  : QueryType extends Readonly<(keyof BaseType | '*')[]>
  ? DataTypeExtractFieldsFromQuery<BaseType, Values<QueryType>>
  : DataTypeExtractFromQueryHash<BaseType, QueryType>

type CheckIsArray<BaseType, QueryType> = BaseType extends (infer Type)[]
  ? (
    null extends Type
    ? (CheckAttributesField<Exclude<Type, null>, QueryType> | null)
    : CheckAttributesField<Type, QueryType>
  )[]
  : CheckAttributesField<BaseType, QueryType>

type DataTypeFromQuery<BaseType, QueryType> =
  null extends BaseType
  ? CheckIsArray<Exclude<BaseType, null>, QueryType> | null
  : CheckIsArray<BaseType, QueryType>

type CheckAttributesField<P, Q> = Q extends { query: infer R }
  ? _DataTypeFromQuery<P, R>
  : _DataTypeFromQuery<P, Q>

type IsAnyCompareLeftType = { __any: never }

type CollectExtraFields<Type, Path> = IsAnyCompareLeftType extends Type
  ? null
  : Type extends ExtraFieldErrorType
  ? Path
  : Type extends (infer R)[]
  ? _CollectExtraFields<R>
  : Type extends object ? _CollectExtraFields<Type> : null;

type _CollectExtraFields<Type> = keyof (Type) extends never
  ? null
  : Values<{ [key in keyof Type]: CollectExtraFields<Type[key], [key]> }>

type _ValidateDataTypeExtraFileds<Extra, Type> = Values<Extra> extends never
  ? Type
  : { error: { extraFields: Values<Extra> } }

type ValidateDataTypeExtraFileds<Type> = _ValidateDataTypeExtraFileds<Exclude<CollectExtraFields<Type, []>, null>, Type>

export type DataTypeFromQueryPair<BaseType, QueryType> = ValidateDataTypeExtraFileds<DataTypeFromQuery<BaseType, QueryType>>

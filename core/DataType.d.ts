declare type RecordType = {
    _meta?: {
        query: any;
    };
};
declare type Values<T> = T extends {
    [K in keyof T]: infer U;
} ? U : never;
declare type DataTypeExtractField<BaseType, Key extends keyof BaseType> = BaseType[Key] extends RecordType ? (null extends BaseType[Key] ? {} | null : {}) : BaseType[Key] extends RecordType[] ? {}[] : BaseType[Key];
declare type DataTypeExtractFieldsFromQuery<BaseType, Fields> = '*' extends Fields ? {
    [key in Exclude<keyof BaseType, '_meta'>]: DataTypeExtractField<BaseType, key>;
} : {
    [key in Fields & keyof (BaseType)]: DataTypeExtractField<BaseType, key>;
};
interface ExtraFieldErrorType {
    error: 'extraFieldError';
}
declare type DataTypeExtractFromQueryHash<BaseType, QueryType> = '*' extends keyof QueryType ? {
    [key in Exclude<(keyof BaseType) | (keyof QueryType), '_meta' | '_params' | '*'>]: (key extends keyof BaseType ? (key extends keyof QueryType ? (QueryType[key] extends true ? DataTypeExtractField<BaseType, key> : DataTypeFromQuery<BaseType[key] & {}, QueryType[key]>) : DataTypeExtractField<BaseType, key>) : ExtraFieldErrorType);
} : {
    [key in keyof QueryType]: (key extends keyof BaseType ? (QueryType[key] extends true ? DataTypeExtractField<BaseType, key> : DataTypeFromQuery<BaseType[key] & {}, QueryType[key]>) : ExtraFieldErrorType);
};
declare type _DataTypeFromQuery<BaseType, QueryType> = QueryType extends keyof BaseType | '*' ? DataTypeExtractFieldsFromQuery<BaseType, QueryType> : QueryType extends Readonly<(keyof BaseType | '*')[]> ? DataTypeExtractFieldsFromQuery<BaseType, Values<QueryType>> : QueryType extends {
    as: string;
} ? {
    error: 'type for alias field is not supported';
} | undefined : DataTypeExtractFromQueryHash<BaseType, QueryType>;
export declare type DataTypeFromQuery<BaseType, QueryType> = BaseType extends any[] ? CheckAttributesField<BaseType[0], QueryType>[] : null extends BaseType ? CheckAttributesField<BaseType & {}, QueryType> | null : CheckAttributesField<BaseType & {}, QueryType>;
declare type CheckAttributesField<P, Q> = Q extends {
    attributes: infer R;
} ? _DataTypeFromQuery<P, R> : _DataTypeFromQuery<P, Q>;
declare type IsAnyCompareLeftType = {
    __any: never;
};
declare type CollectExtraFields<Type, Path> = IsAnyCompareLeftType extends Type ? null : Type extends ExtraFieldErrorType ? Path : Type extends (infer R)[] ? _CollectExtraFields<R> : _CollectExtraFields<Type>;
declare type _CollectExtraFields<Type> = Type extends object ? (keyof (Type) extends never ? null : Values<{
    [key in keyof Type]: CollectExtraFields<Type[key], [key]>;
}>) : null;
declare type SelectString<T> = T extends string ? T : never;
declare type _ValidateDataTypeExtraFileds<Extra, Type> = SelectString<Values<Extra>> extends never ? Type : {
    error: {
        extraFields: SelectString<Values<Extra>>;
    };
};
declare type ValidateDataTypeExtraFileds<Type> = _ValidateDataTypeExtraFileds<CollectExtraFields<Type, []>, Type>;
declare type RequestBase = {
    api: string;
    query: any;
    id?: number;
    params?: any;
    _meta?: {
        data: any;
    };
};
declare type DataTypeBaseFromRequestType<R extends RequestBase, ID> = R extends {
    _meta?: {
        data: infer DataType;
    };
} ? (ID extends number ? ([DataType, R['params']] extends [(infer DT)[], {
    ids: number[];
} | undefined] ? DT : never) : DataType) : never;
export declare type DataTypeFromRequest<Req extends RequestBase, R extends RequestBase> = ValidateDataTypeExtraFileds<DataTypeFromQuery<DataTypeBaseFromRequestType<Req, R['id']>, R['query']>>;
export {};

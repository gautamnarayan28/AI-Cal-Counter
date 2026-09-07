import Foundation

public enum PortionBasis: String, Codable, CaseIterable, Sendable { case servings, grams }
public enum JournalError: Error, LocalizedError {
    case invalidQuantity, missingServing, invalidTarget
    public var errorDescription: String? {
        switch self {
        case .invalidQuantity: return "enter a quantity greater than zero"
        case .missingServing: return "this food has no defined serving; enter its weight in grams"
        case .invalidTarget: return "enter a daily target between 500 and 10,000 kcal"
        }
    }
}
public struct FoodReference: Codable, Identifiable, Sendable {
    public let id: String
    public let name: String
    public let kcalPer100g: Double
    public let kcalPerServing: Double?
    public let servingUnit: String?
    public let servingUsable: Bool
    public let source: String
    public let sourceRow: Int
    public init(id: String, name: String, kcalPer100g: Double, kcalPerServing: Double?, servingUnit: String?, servingUsable: Bool, source: String, sourceRow: Int) {
        self.id=id; self.name=name; self.kcalPer100g=kcalPer100g; self.kcalPerServing=kcalPerServing; self.servingUnit=servingUnit; self.servingUsable=servingUsable; self.source=source; self.sourceRow=sourceRow
    }
    public func calories(quantity: Double, basis: PortionBasis) throws -> Double {
        guard quantity.isFinite, quantity > 0 else { throw JournalError.invalidQuantity }
        let total: Double
        switch basis {
        case .grams: total = kcalPer100g * quantity / 100
        case .servings:
            guard servingUsable, let kcal = kcalPerServing else { throw JournalError.missingServing }
            total = kcal * quantity
        }
        guard total.isFinite, total >= 0 else { throw JournalError.invalidQuantity }
        return total
    }
}
public struct JournalMeal: Codable, Identifiable, Sendable {
    public let id: UUID
    public var date: Date
    public var food: FoodReference
    public var quantity: Double
    public var basis: PortionBasis
    public init(id: UUID = UUID(), date: Date = Date(), food: FoodReference, quantity: Double, basis: PortionBasis) throws {
        _ = try food.calories(quantity: quantity, basis: basis)
        self.id=id; self.date=date; self.food=food; self.quantity=quantity; self.basis=basis
    }
    public var calories: Double { (try? food.calories(quantity: quantity, basis: basis)) ?? 0 }
}
public struct JournalSnapshot: Codable, Sendable {
    public var version: Int = 1
    public var meals: [JournalMeal] = []
    public var dailyTarget: Double = 1900
    public init() {}
    public func validate() throws {
        guard version == 1 else { throw CocoaError(.coderReadCorrupt) }
        guard dailyTarget.isFinite, (500...10000).contains(dailyTarget) else { throw JournalError.invalidTarget }
        guard Set(meals.map(\.id)).count == meals.count else { throw CocoaError(.coderReadCorrupt) }
        for meal in meals { _ = try meal.food.calories(quantity: meal.quantity, basis: meal.basis) }
    }
    public func consumed(on date: Date, calendar: Calendar = .current) -> Double {
        meals.filter { calendar.isDate($0.date, inSameDayAs: date) }.reduce(0) { $0 + $1.calories }
    }
}
public struct JournalFile {
    public let url: URL
    public init(url: URL) { self.url=url }
    public func load() throws -> JournalSnapshot {
        guard FileManager.default.fileExists(atPath: url.path) else { return JournalSnapshot() }
        let state = try JSONDecoder().decode(JournalSnapshot.self, from: Data(contentsOf: url))
        try state.validate()
        return state
    }
    public func save(_ snapshot: JournalSnapshot) throws {
        try snapshot.validate()
        let data = try JSONEncoder().encode(snapshot)
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try data.write(to: url, options: .atomic)
    }
}
